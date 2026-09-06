import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import express from "express";
import { Api, FixedWindowRateLimiter, findAvailableRandomUsername, validateCharacterCustomization } from "../src/server/Api";
import {
    CharacterLimitError,
    Database,
    DuplicateUsernameError,
    isDuplicateUsernameConstraintError,
} from "../src/server/Database";
import { hasSingleColumnUniqueUsernameIndex } from "../src/server/utils/database/mysql";
import {
    createPlayerPersistenceSnapshot,
    persistPlayerSnapshot,
} from "../src/server/rooms/playerPersistence";
import {
    CHAT_MESSAGE_MAX_LENGTH,
    ChatRateLimiter,
    ChatRoom,
    authenticateChatIdentity,
    createChatIdentity,
    sanitizeChatText,
} from "../src/server/rooms/ChatRoom";
import {
    activatePlayerSession,
    clearPlayerSessions,
    finalizePlayerSession,
    getPlayerSession,
    ownsPlayerSession,
    registerPlayerSession,
    reservePlayerSession,
    unregisterPlayerSession,
} from "../src/server/rooms/PlayerSessionRegistry";
import { Auth } from "../src/server/rooms/commands/Auth";
import { ServerMsg } from "../src/shared/types";

function closeServer(server: Server): Promise<void> {
    return new Promise((resolve, reject) => {
        server.close((error) => (error ? reject(error) : resolve()));
    });
}

async function startApi(database: Partial<Database>, options: ConstructorParameters<typeof Api>[2] = {}) {
    const app = express();
    app.use(express.json());
    new Api(app, database as Database, options);

    const server = createServer(app);
    await new Promise<void>((resolve, reject) => {
        server.once("error", reject);
        server.listen(0, "127.0.0.1", resolve);
    });

    const address = server.address() as AddressInfo;
    return {
        server,
        baseUrl: `http://127.0.0.1:${address.port}`,
    };
}

test("game-room auth requires a valid token and character ownership", async () => {
    const ownedCharacter = { id: 42, user_id: 7, online: 0, name: "Owned" };
    const db = {
        getUserByToken: async (token: string) => (token === "valid-token" ? { id: 7 } : null),
        getCharacter: async (id: number) => (id === 42 ? ownedCharacter : id === 43 ? { id, user_id: 8, online: 0 } : null),
    };

    assert.equal(await Auth.check(db, { token: "", character_id: 42 }), false);
    assert.equal(await Auth.check(db, { token: "invalid", character_id: 42 }), false);
    assert.equal(await Auth.check(db, { token: "valid-token", character_id: 43 }), false);
    assert.equal(await Auth.check(db, { token: "valid-token", character_id: 999 }), false);
    assert.equal(await Auth.check(db, { token: "valid-token", character_id: "not-a-number" }), false);
    assert.equal(await Auth.check(db, { token: "valid-token", character_id: "42" }), ownedCharacter);
});

test("game-room auth rejects an already-online owned character", async () => {
    const db = {
        getUserByToken: async () => ({ id: 7 }),
        getCharacter: async () => ({ id: 42, user_id: 7, online: 1 }),
    };

    assert.equal(await Auth.check(db, { token: "valid-token", character_id: 42 }), false);
});

test("game-room auth only admits a character to its persisted location", async () => {
    const character = { id: 42, user_id: 7, online: 0, location: "lh_town" };
    const db = {
        getUserByToken: async () => ({ id: 7 }),
        getCharacter: async () => character,
    };

    assert.equal(await Auth.check(db, { token: "valid-token", character_id: 42 }, "training_ground"), false);
    assert.equal(await Auth.check(db, { token: "valid-token", character_id: 42 }, "lh_town"), character);
});

test("Database.getCharacter returns null for unknown IDs without loading relations", async () => {
    let relationQueries = 0;
    const database = new Database({} as any);
    (database as any).querier = {
        get: async () => undefined,
        all: async () => {
            relationQueries += 1;
            return [];
        },
    };

    assert.equal(await database.getCharacter(999), null);
    assert.equal(relationQueries, 0);
});

test("Database.getCharacter loads completed quests so their status persists", async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const database = new Database({} as any);
    (database as any).querier = {
        get: async () => ({ id: 42, user_id: 7 }),
        all: async (sql: string, params: unknown[]) => {
            queries.push({ sql, params });
            return sql.includes("character_quests") ? [{ key: "FIRST_QUEST", status: 1, qty: 1 }] : [];
        },
    };

    const character = await database.getCharacter(42);
    assert.deepEqual(character.quests, [{ key: "FIRST_QUEST", status: 1, qty: 1 }]);

    const questQuery = queries.find(({ sql }) => sql.includes("character_quests"));
    assert.ok(questQuery);
    assert.doesNotMatch(questQuery.sql, /status\s*=/i);
    assert.deepEqual(questQuery.params, [42]);
});

test("character updates use bound parameters for every persisted value", async () => {
    const queries: Array<{ sql: string; params: unknown[] }> = [];
    const database = new Database({} as any);
    (database as any).querier = {
        run: async (sql: string, params: unknown[]) => {
            queries.push({ sql, params });
        },
    };

    await database.updateCharacter(42, {
        location: "oakwatch' --",
        x: 1,
        y: 2,
        z: 3,
        rot: 4,
        level: 5,
        maxHealth: 100,
        maxMana: 90,
        player_data: {
            gold: 80,
            experience: 70,
            points: 6,
            strength: 20,
            endurance: 21,
            agility: 22,
            intelligence: 23,
            wisdom: 24,
        },
    });

    assert.equal(queries.length, 1);
    assert.doesNotMatch(queries[0].sql, /oakwatch/);
    assert.equal(queries[0].params[0], "oakwatch' --");
    assert.equal(queries[0].params.at(-1), 42);
});

test("queued persistence snapshots base stats and delegates one atomic database save", async () => {
    const calls: string[] = [];
    let savedCharacter: any;
    const database = {
        savePlayerSnapshot: async (_id: number, snapshot: any) => {
            calls.push("transaction");
            savedCharacter = snapshot;
        },
    };

    const baseStats = {
        maxHealth: 100,
        maxMana: 80,
        strength: 20,
        endurance: 21,
        agility: 22,
        intelligence: 23,
        wisdom: 24,
    };
    const player: any = {
        id: 42,
        location: "lh_town",
        x: 1,
        y: 2,
        z: 3,
        rot: 4,
        level: 5,
        statsCTRL: { getStat: (key: keyof typeof baseStats) => baseStats[key] },
        player_data: {
            gold: 50,
            experience: 60,
            points: 7,
            strength: 30,
            endurance: 21,
            agility: 22,
            intelligence: 23,
            wisdom: 24,
            inventory: new Map([["0", { key: "potion_small_red", qty: 2 }]]),
            abilities: new Map([["base_attack", { key: "base_attack" }]]),
            quests: new Map(),
            hotbar: new Map([["1", { digit: 1, type: "ability", key: "base_attack" }]]),
        },
        equipment: new Map([["sword_01", { key: "sword_01", slot: 6 }]]),
    };

    const snapshot = createPlayerPersistenceSnapshot(player);
    const save = persistPlayerSnapshot(database, player.id, snapshot);
    player.location = "training_ground";
    player.player_data.strength = 999;
    player.player_data.inventory.get("0").qty = 999;
    await save;

    assert.deepEqual(calls, ["transaction"]);
    assert.equal(savedCharacter.location, "lh_town");
    assert.equal(savedCharacter.player_data.strength, 20);
    assert.deepEqual(savedCharacter.inventory, [{ key: "potion_small_red", qty: 2 }]);
});

test("Database.close closes its adapter once and createCharacter rejects an unknown token", async () => {
    let closes = 0;
    let writes = 0;
    const database = new Database({} as any);
    (database as any).querier = {
        transaction: async (work: (executor: any) => Promise<unknown>) =>
            work({
                get: async () => undefined,
                run: async () => {
                    writes += 1;
                },
            }),
        close: async () => {
            closes += 1;
        },
    };

    assert.equal(await database.createCharacter("invalid", "Alice", "humanoid", 0, "Head_Base"), null);
    assert.equal(writes, 0);

    await Promise.all([database.close(), database.close()]);
    assert.equal(closes, 1);
});

test("get_character requires a token and hides characters owned by another user", async (t) => {
    const database = {
        getUserByToken: async (token: string) => (token === "valid-token" ? { id: 7 } : null),
        getCharacter: async (id: number) => {
            if (id === 42) return { id, user_id: 7, name: "Owned" };
            if (id === 43) return { id, user_id: 8, name: "Somebody Else" };
            return null;
        },
    };
    const { server, baseUrl } = await startApi(database as Partial<Database>);
    t.after(() => closeServer(server));

    const missingToken = await fetch(`${baseUrl}/get_character?character_id=42`);
    assert.equal(missingToken.status, 400);

    const invalidToken = await fetch(`${baseUrl}/get_character?character_id=42`, {
        headers: { Authorization: "Bearer invalid" },
    });
    assert.equal(invalidToken.status, 401);

    const otherUsersCharacter = await fetch(`${baseUrl}/get_character?character_id=43`, {
        headers: { Authorization: "Bearer valid-token" },
    });
    assert.equal(otherUsersCharacter.status, 404);

    const unknownCharacter = await fetch(`${baseUrl}/get_character?character_id=999`, {
        headers: { Authorization: "Bearer valid-token" },
    });
    assert.equal(unknownCharacter.status, 404);

    const ownedCharacter = await fetch(`${baseUrl}/get_character?character_id=42`, {
        headers: { Authorization: "Bearer valid-token" },
    });
    assert.equal(ownedCharacter.status, 200);
    assert.equal((await ownedCharacter.json()).character.name, "Owned");
});

test("quick play rate limiting is per resolved Express client IP", () => {
    const limiter = new FixedWindowRateLimiter(2, 1_000);
    assert.equal(limiter.allow("127.0.0.1", 1_000), true);
    assert.equal(limiter.allow("127.0.0.1", 1_100), true);
    assert.equal(limiter.allow("127.0.0.1", 1_200), false);
    assert.equal(limiter.allow("127.0.0.2", 1_200), true);
    assert.equal(limiter.allow("127.0.0.1", 2_000), true);
});

test("login rejects excess requests before another password lookup", async (t) => {
    let passwordLookups = 0;
    const database = {
        getUser: async () => {
            passwordLookups += 1;
            return { id: 7, username: "Alice" };
        },
        refreshToken: async () => ({ id: 7, username: "Alice", token: "fresh-token" }),
    };
    const { server, baseUrl } = await startApi(database as Partial<Database>, {
        loginRateLimiter: new FixedWindowRateLimiter(1, 60_000),
    });
    t.after(() => closeServer(server));

    const request = () =>
        fetch(`${baseUrl}/login`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username: "Alice", password: "secret" }),
        });
    assert.equal((await request()).status, 200);
    const limited = await request();
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "600");
    assert.equal(passwordLookups, 1);
});

test("username uniqueness helpers recognize only the account-name constraint", () => {
    assert.equal(
        isDuplicateUsernameConstraintError({
            code: "ER_DUP_ENTRY",
            errno: 1062,
            sqlMessage: "Duplicate entry for key 'users.uq_users_username'",
        }),
        true
    );
    assert.equal(
        isDuplicateUsernameConstraintError({
            code: "ER_DUP_ENTRY",
            errno: 1062,
            sqlMessage: "Duplicate entry for key 'users.uq_users_token'",
        }),
        false
    );
    assert.equal(
        isDuplicateUsernameConstraintError({
            code: "SQLITE_CONSTRAINT",
            message: "SQLITE_CONSTRAINT: UNIQUE constraint failed: users.username",
        }),
        true
    );

    assert.equal(
        hasSingleColumnUniqueUsernameIndex([
            { index_name: "PRIMARY", non_unique: 0, sequence: 1, column_name: "id" },
            { index_name: "uq_users_username", non_unique: "0", sequence: "1", column_name: "username" },
        ]),
        true
    );
    assert.equal(
        hasSingleColumnUniqueUsernameIndex([
            { index_name: "composite", non_unique: 0, sequence: 1, column_name: "username" },
            { index_name: "composite", non_unique: 0, sequence: 2, column_name: "token" },
        ]),
        false
    );
});

test("a duplicate-key login race rechecks credentials instead of returning 500", async (t) => {
    let userLookups = 0;
    const database = {
        getUser: async () => {
            userLookups += 1;
            return userLookups === 1 ? null : { id: 7, username: "Alice", token: "shared-token", password: "hidden" };
        },
        hasUser: async () => null,
        saveUser: async () => {
            throw new DuplicateUsernameError();
        },
        getUserById: async () => ({
            id: 7,
            username: "Alice",
            token: "shared-token",
            password: "hidden",
            characters: [],
        }),
    };
    const { server, baseUrl } = await startApi(database as Partial<Database>);
    t.after(() => closeServer(server));

    const response = await fetch(`${baseUrl}/login`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: "Alice", password: "secret" }),
    });
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.user.token, "shared-token");
    assert.equal("password" in body.user, false);
    assert.equal(userLookups, 2);
});

test("concurrent first logins create one SQLite user and return one durable identity", async (t) => {
    const previousPath = process.env.DATABASE_PATH;
    process.env.DATABASE_PATH = ":memory:";
    const database = new Database({ database: "sqllite" } as any);
    await database.init();
    await database.create();
    const querier = (database as any).querier;
    const originalGetUser = database.getUser.bind(database);
    let releaseInitialLookups!: () => void;
    const initialLookupGate = new Promise<void>((resolve) => {
        releaseInitialLookups = resolve;
    });
    let initialLookups = 0;
    database.getUser = async (...args: Parameters<Database["getUser"]>) => {
        if (initialLookups < 2) {
            initialLookups += 1;
            if (initialLookups === 2) {
                releaseInitialLookups();
            }
            await initialLookupGate;
        }
        return originalGetUser(...args);
    };
    const { server, baseUrl } = await startApi(database);
    t.after(async () => {
        await closeServer(server);
        await database.close();
        if (previousPath === undefined) {
            delete process.env.DATABASE_PATH;
        } else {
            process.env.DATABASE_PATH = previousPath;
        }
    });

    const request = () =>
        fetch(`${baseUrl}/login`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ username: "Concurrent Hero", password: "same-secret" }),
        });
    const responses = await Promise.all([request(), request()]);
    const bodies = await Promise.all(responses.map((response) => response.json()));

    assert.deepEqual(responses.map((response) => response.status), [200, 200]);
    assert.equal(bodies[0].user.id, bodies[1].user.id);
    assert.equal(bodies[0].user.token, bodies[1].user.token);
    assert.equal("password" in bodies[0].user, false);
    assert.equal(initialLookups, 2);
    assert.equal((await querier.get("SELECT COUNT(*) AS count FROM users WHERE username=?;", ["Concurrent Hero"])).count, 1);
});

test("quick play username allocation stops after twenty collisions", async () => {
    let queries = 0;
    const username = await findAvailableRandomUsername(
        async () => {
            queries += 1;
            return { count: 1 };
        },
        () => "Already Used"
    );

    assert.equal(username, null);
    assert.equal(queries, 20);
});

test("returnRandomUser rejects excess requests before another database write", async (t) => {
    let savedUsers = 0;
    const database = {
        doesUserNameExists: async () => ({ count: 0 }),
        saveUser: async (username: string) => {
            savedUsers += 1;
            return { id: savedUsers, username, token: `token-${savedUsers}` };
        },
        createCharacter: async () => ({ id: 42, name: "Guest Hero" }),
    };
    const { server, baseUrl } = await startApi(database as Partial<Database>, {
        quickPlayRateLimiter: new FixedWindowRateLimiter(1, 60_000),
    });
    t.after(() => closeServer(server));

    const first = await fetch(`${baseUrl}/returnRandomUser`, { method: "POST" });
    assert.equal(first.status, 200);

    const second = await fetch(`${baseUrl}/returnRandomUser`, { method: "POST" });
    assert.equal(second.status, 429);
    assert.equal(second.headers.get("retry-after"), "600");
    assert.equal(savedUsers, 1);
});

test("character customization accepts only safe names and selectable race assets", () => {
    assert.deepEqual(validateCharacterCustomization("  Аркадий  Герой ", "humanoid", "0", "Head_Base"), {
        name: "Аркадий Герой",
        race: "humanoid",
        material: 0,
        head: "Head_Base",
    });
    assert.equal(validateCharacterCustomization("<script>", "humanoid", 0, "Head_Base"), null);
    assert.equal(validateCharacterCustomization("Alice", "skeleton_01", 0, "Head_Base"), null);
    assert.equal(validateCharacterCustomization("Alice", "humanoid", -1, "Head_Base"), null);
    assert.equal(validateCharacterCustomization("Alice", "humanoid", 999, "Head_Base"), null);
    assert.equal(validateCharacterCustomization("Alice", "humanoid", 0.5, "Head_Base"), null);
    assert.equal(validateCharacterCustomization("Alice", "humanoid", 0, "Unknown_Head"), null);
});

test("create_character authenticates and validates before writing", async (t) => {
    const createCalls: unknown[][] = [];
    const database = {
        getUserByToken: async (token: string) => (token === "valid-token" ? { id: 7 } : null),
        createCharacter: async (...args: unknown[]) => {
            createCalls.push(args);
            return { id: 42, name: args[1] };
        },
    };
    const { server, baseUrl } = await startApi(database as Partial<Database>);
    t.after(() => closeServer(server));

    const invalidToken = await fetch(`${baseUrl}/create_character`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            token: "invalid",
            name: "Alice",
            race: "humanoid",
            material: 0,
            head: "Head_Base",
        }),
    });
    assert.equal(invalidToken.status, 401);

    const invalidAsset = await fetch(`${baseUrl}/create_character`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            token: "valid-token",
            name: "Alice",
            race: "humanoid",
            material: 0,
            head: "Not_A_Head",
        }),
    });
    assert.equal(invalidAsset.status, 400);

    const valid = await fetch(`${baseUrl}/create_character`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            token: "valid-token",
            name: "  Alice   Quest  ",
            race: "humanoid",
            material: 1,
            head: "Head_Mage",
        }),
    });
    assert.equal(valid.status, 200);
    assert.deepEqual(createCalls, [["valid-token", "Alice Quest", "humanoid", 1, "Head_Mage"]]);
});

test("create_character rate limiting runs before another database lookup", async (t) => {
    let tokenLookups = 0;
    let creates = 0;
    const database = {
        getUserByToken: async () => {
            tokenLookups += 1;
            return { id: 7 };
        },
        createCharacter: async () => {
            creates += 1;
            return { id: 42 };
        },
    };
    const { server, baseUrl } = await startApi(database as Partial<Database>, {
        characterCreateRateLimiter: new FixedWindowRateLimiter(1, 60_000),
    });
    t.after(() => closeServer(server));

    const request = () => fetch(`${baseUrl}/create_character`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "valid-token", name: "Alice", race: "humanoid", material: 0, head: "Head_Base" }),
    });
    assert.equal((await request()).status, 200);
    const limited = await request();
    assert.equal(limited.status, 429);
    assert.equal(limited.headers.get("retry-after"), "600");
    assert.equal(tokenLookups, 1);
    assert.equal(creates, 1);
});

test("create_character returns a conflict when the account reached its durable limit", async (t) => {
    const database = {
        getUserByToken: async () => ({ id: 7 }),
        createCharacter: async () => {
            throw new CharacterLimitError();
        },
    };
    const { server, baseUrl } = await startApi(database as Partial<Database>);
    t.after(() => closeServer(server));

    const response = await fetch(`${baseUrl}/create_character`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "valid-token", name: "Alice", race: "humanoid", material: 0, head: "Head_Base" }),
    });
    assert.equal(response.status, 409);
    assert.deepEqual(await response.json(), { message: "Character Limit Reached" });
});

test("create_character converts database failures into a 500 response", async (t) => {
    const database = {
        getUserByToken: async () => {
            throw new Error("database unavailable");
        },
    };
    const { server, baseUrl } = await startApi(database as Partial<Database>);
    t.after(() => closeServer(server));

    const response = await fetch(`${baseUrl}/create_character`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            token: "valid-token",
            name: "Alice",
            race: "humanoid",
            material: 0,
            head: "Head_Base",
        }),
    });
    assert.equal(response.status, 500);
});

test("token authentication endpoints convert database failures into 500 responses", async (t) => {
    const database = {
        getUserWithToken: async () => {
            throw new Error("token store unavailable");
        },
        checkToken: async () => {
            throw new Error("token store unavailable");
        },
    };
    const { server, baseUrl } = await startApi(database as Partial<Database>);
    t.after(() => closeServer(server));

    const login = await fetch(`${baseUrl}/loginWithToken`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "valid-shape-token" }),
    });
    const check = await fetch(`${baseUrl}/check`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token: "valid-shape-token" }),
    });

    assert.equal(login.status, 500);
    assert.equal(check.status, 500);
});

test("chat sanitization removes controls and applies a Unicode-safe maximum", () => {
    assert.equal(sanitizeChatText("  hello\n\u0000world  ", CHAT_MESSAGE_MAX_LENGTH), "hello world");
    assert.equal(Array.from(sanitizeChatText("🗺️".repeat(300), CHAT_MESSAGE_MAX_LENGTH)).length, CHAT_MESSAGE_MAX_LENGTH);
    assert.equal(sanitizeChatText({ message: "not a string" }, CHAT_MESSAGE_MAX_LENGTH), "");
});

test("chat rate limiting follows the trusted character across chat connections", () => {
    const limiter = new ChatRateLimiter(2, 1_000);

    assert.equal(limiter.allow(42, 1_000), true);
    assert.equal(limiter.allow(42, 1_100), true);
    assert.equal(limiter.allow(42, 1_200), false);
    assert.equal(limiter.allow(43, 1_200), true);
    assert.equal(limiter.allow(42, 2_001), true);
});

test("chat handler cannot reset a character rate limit by changing chat session", () => {
    clearPlayerSessions();
    registerPlayerSession(42, "trusted-game-session");
    const room = Object.create(ChatRoom.prototype) as ChatRoom;
    (room as any).broadcast = () => undefined;
    (room as any).rateLimiter = new ChatRateLimiter(1, 1_000);
    (room as any).identities = new Map([
        ["chat-a", createChatIdentity("chat-a", 42, "Alice")],
        ["chat-b", createChatIdentity("chat-b", 42, "Alice")],
    ]);

    assert.equal(room.handlePlayerMessage({ sessionId: "chat-a" }, { message: "first" }, 1_000), true);
    assert.equal(room.handlePlayerMessage({ sessionId: "chat-b" }, { message: "second" }, 1_001), false);
    clearPlayerSessions();
});

test("chat authentication binds a token to its owned database character", async () => {
    const database = {
        getUserByToken: async (token: string) => (token === "valid-token" ? { id: 7 } : null),
        getCharacter: async (id: number) =>
            id === 42 ? { id, user_id: 7, name: "Alice" } : id === 43 ? { id, user_id: 8, name: "Mallory" } : null,
    };

    assert.equal(await authenticateChatIdentity(database as any, { token: "invalid", character_id: 42 }, "chat-a"), false);
    assert.equal(await authenticateChatIdentity(database as any, { token: "valid-token", character_id: 43 }, "chat-a"), false);
    assert.equal(await authenticateChatIdentity(database as any, { token: "valid-token", character_id: 999 }, "chat-a"), false);
    assert.deepEqual(await authenticateChatIdentity(database as any, { token: "valid-token", character_id: "42" }, "chat-a"), {
        chatSessionId: "chat-a",
        characterId: 42,
        name: "Alice",
    });
});

test("player session registry atomically reserves a character and rejects a parallel login", () => {
    clearPlayerSessions();
    assert.equal(reservePlayerSession(42, "first-game-session", 1_000), true);
    assert.equal(reservePlayerSession(42, "parallel-game-session", 1_001), false);
    assert.equal(getPlayerSession(42), undefined);
    assert.equal(activatePlayerSession(42, "first-game-session"), true);
    assert.equal(getPlayerSession(42), "first-game-session");
    assert.equal(ownsPlayerSession(42, "first-game-session"), true);
    assert.equal(registerPlayerSession(42, "parallel-game-session"), false);
    assert.equal(unregisterPlayerSession(42, "parallel-game-session"), false);
    assert.equal(unregisterPlayerSession(42, "first-game-session"), true);
});

test("an abandoned pending reservation expires but an active session never does", () => {
    clearPlayerSessions();
    assert.equal(reservePlayerSession(42, "abandoned", 1_000), true);
    assert.equal(reservePlayerSession(42, "retry", 31_000), true);
    assert.equal(activatePlayerSession(42, "retry"), true);
    assert.equal(reservePlayerSession(42, "late-login", Number.MAX_SAFE_INTEGER), false);
    clearPlayerSessions();
});

test("leave lifecycle saves before removal and only its owning session may clear online status", async () => {
    clearPlayerSessions();
    registerPlayerSession(42, "current-session");
    const events: string[] = [];

    await finalizePlayerSession(42, "current-session", {
        save: async () => {
            events.push("save");
        },
        remove: () => {
            events.push("delete", "untarget");
        },
        markOffline: async () => {
            events.push("offline");
        },
    });
    assert.deepEqual(events, ["save", "delete", "untarget", "offline"]);
    assert.equal(getPlayerSession(42), undefined);

    registerPlayerSession(42, "replacement-session");
    events.length = 0;
    await finalizePlayerSession(42, "stale-session", {
        save: async () => {
            events.push("save");
        },
        remove: () => {
            events.push("delete", "untarget");
        },
        markOffline: async () => {
            events.push("offline");
        },
    });
    assert.deepEqual(events, ["delete", "untarget"]);
    assert.equal(getPlayerSession(42), "replacement-session");
    clearPlayerSessions();
});

test("leave lifecycle releases a session even when persistence fails", async () => {
    clearPlayerSessions();
    registerPlayerSession(42, "broken-session");
    const events: string[] = [];

    await finalizePlayerSession(42, "broken-session", {
        save: async () => {
            events.push("save");
            throw new Error("save failed");
        },
        remove: () => {
            events.push("remove");
        },
        markOffline: async () => {
            events.push("offline");
            throw new Error("status failed");
        },
        onError: (stage) => events.push(`error:${stage}`),
    });

    assert.deepEqual(events, ["save", "error:save", "remove", "offline", "error:offline"]);
    assert.equal(ownsPlayerSession(42, "broken-session"), false);
});

test("chat messages use the connection-bound identity instead of spoofed fields", () => {
    clearPlayerSessions();
    const room = Object.create(ChatRoom.prototype) as ChatRoom;
    const broadcasts: Array<{ type: number; message: any }> = [];
    (room as any).broadcast = (type: number, message: any) => broadcasts.push({ type, message });

    const client = { sessionId: "trusted-chat-session" } as any;
    (room as any).identities = new Map([[client.sessionId, createChatIdentity(client.sessionId, 42, "  Alice  ")]]);
    (room as any).rateLimiter = new ChatRateLimiter();
    registerPlayerSession(42, "trusted-game-session");

    assert.equal(
        room.handlePlayerMessage(
            client,
            {
                senderId: "victim-game-session",
                name: "Mallory",
                message: "  Hello from Alice  ",
            },
            1_000
        ),
        true
    );

    assert.equal(broadcasts.length, 1);
    assert.equal(broadcasts[0].type, ServerMsg.CHAT_MESSAGE);
    assert.equal(broadcasts[0].message.senderID, "trusted-game-session");
    assert.equal(broadcasts[0].message.name, "Alice");
    assert.equal(broadcasts[0].message.message, "Hello from Alice");
    clearPlayerSessions();
});
