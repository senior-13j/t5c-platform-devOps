import assert from "node:assert/strict";
import { test } from "node:test";
import { CharacterLimitError, Database, MAX_CHARACTERS_PER_USER } from "../src/server/Database";
import {
    MAX_WEBSOCKET_PAYLOAD_BYTES,
    createWebSocketOriginGuard,
    isCorsOriginAllowed,
    resolveAllowedCorsOrigins,
} from "../src/server/HttpSecurity";
import {
    GAMEPLAY_ACTION_BURST,
    GAMEPLAY_MOVEMENT_BURST,
    GAMEPLAY_PING_BURST,
    INVALID_GAMEPLAY_MESSAGE_CLOSE_CODE,
    GameplayMessageGuard,
    dispatchGameplayMessageSafely,
    getPingTimestamp,
    isClickToMoveTargetAllowed,
    isMovementDisplacementAllowed,
    normalizeMovementInput,
} from "../src/server/rooms/GameplayMessageGuard";
import type { PlayerPersistenceSnapshot } from "../src/server/rooms/playerPersistence";
import { ServerMsg } from "../src/shared/types";

test("CORS defaults are strict in production and configurable by exact origin", () => {
    const production = resolveAllowedCorsOrigins({ NODE_ENV: "production" });
    assert.equal(isCorsOriginAllowed("https://arkadii.world", production), true);
    assert.equal(isCorsOriginAllowed("https://www.arkadii.world", production), true);
    assert.equal(isCorsOriginAllowed("https://evil.example", production), false);
    assert.equal(isCorsOriginAllowed("https://arkadii.world.evil.example", production), false);
    assert.equal(isCorsOriginAllowed("https://arkadii.world/forged-path", production), false);
    assert.equal(isCorsOriginAllowed(undefined, production), true);

    const configured = resolveAllowedCorsOrigins({
        NODE_ENV: "production",
        CORS_ALLOWED_ORIGINS: "https://play.example.test/, http://localhost:8080",
    });
    assert.deepEqual([...configured], ["https://play.example.test", "http://localhost:8080"]);
    assert.equal(isCorsOriginAllowed("https://arkadii.world", configured), false);
    assert.equal(resolveAllowedCorsOrigins({ CORS_ALLOWED_ORIGINS: "*" }).size, 0);
});

test("WebSocket upgrade guard rejects foreign browser origins but permits trusted and CLI clients", async () => {
    assert.equal(MAX_WEBSOCKET_PAYLOAD_BYTES, 8_192);
    const guard = createWebSocketOriginGuard({ NODE_ENV: "production" });
    const context = {} as any;
    assert.equal(await guard(new Request("https://arkadii.world/game"), context), undefined);
    assert.equal(
        await guard(new Request("https://arkadii.world/game", { headers: { Origin: "https://arkadii.world" } }), context),
        undefined
    );
    const rejected = await guard(
        new Request("https://arkadii.world/game", { headers: { Origin: "https://evil.example" } }),
        context
    );
    assert.equal(rejected?.status, 403);
});

test("gameplay budgets are isolated per client and separately constrain movement and actions", () => {
    const guard = new GameplayMessageGuard();
    for (let index = 0; index < GAMEPLAY_MOVEMENT_BURST; index += 1) {
        const messageType = index % 2 === 0 ? ServerMsg.PLAYER_MOVE : ServerMsg.PLAYER_MOVE_TO;
        assert.equal(guard.allow("player-a", messageType, 1_000), true);
    }
    assert.equal(guard.allow("player-a", ServerMsg.PLAYER_MOVE_TO, 1_000), false);
    assert.equal(guard.allow("player-b", ServerMsg.PLAYER_MOVE, 1_000), true);
    assert.equal(guard.allow("player-a", ServerMsg.PLAYER_MOVE, 1_100), true);

    const actionGuard = new GameplayMessageGuard();
    for (let index = 0; index < GAMEPLAY_ACTION_BURST; index += 1) {
        assert.equal(actionGuard.allow("player-a", ServerMsg.PLAYER_USE_ITEM, 1_000), true);
    }
    assert.equal(actionGuard.allow("player-a", ServerMsg.PLAYER_USE_ITEM, 1_000), false);
    assert.equal(actionGuard.allow("player-a", 999_999, 1_000), false);

    const pingGuard = new GameplayMessageGuard();
    for (let index = 0; index < GAMEPLAY_PING_BURST; index += 1) {
        assert.equal(pingGuard.allow("player-a", ServerMsg.PING, 1_000), true);
    }
    assert.equal(pingGuard.allow("player-a", ServerMsg.PING, 1_000), false);
    assert.equal(pingGuard.allow("player-a", ServerMsg.PING, 2_000), true);
});

test("ping payloads accept only a finite client timestamp", () => {
    assert.equal(getPingTimestamp(1_725_000_000_000), 1_725_000_000_000);
    assert.equal(getPingTimestamp({ date: 123, ignored: "not reflected" }), 123);
    assert.equal(getPingTimestamp({ date: Number.NaN }), null);
    assert.equal(getPingTimestamp({ date: "123" }), null);
    assert.equal(getPingTimestamp({}), null);
});

test("movement validation rejects replay and bounds both input and resulting displacement", () => {
    const normalized = normalizeMovementInput({ seq: 11, h: 3, v: 4 }, 10);
    assert.equal(normalized?.seq, 11);
    assert.ok(Math.abs((normalized?.h ?? 0) - 0.6) < 1e-12);
    assert.ok(Math.abs((normalized?.v ?? 0) - 0.8) < 1e-12);
    assert.equal(normalizeMovementInput({ seq: 10, h: 1, v: 0 }, 10), null);
    assert.equal(normalizeMovementInput({ seq: 11, h: Number.NaN, v: 0 }, 10), null);
    assert.equal(normalizeMovementInput({ seq: 11, h: Number.MAX_VALUE, v: Number.MAX_VALUE }, 10), null);
    assert.equal(normalizeMovementInput({ seq: 11, h: 0, v: 0 }, 10), null);

    const source = { x: 1, y: 0, z: 1 };
    assert.equal(isMovementDisplacementAllowed(source, { x: 1.6, y: 10, z: 1 }, 0.6), true);
    assert.equal(isMovementDisplacementAllowed(source, { x: 2, y: 0, z: 1 }, 0.6), false);
    assert.equal(isMovementDisplacementAllowed(source, { x: Number.NaN, y: 0, z: 1 }, 0.6), false);
    assert.equal(isClickToMoveTargetAllowed(source, { x: 65, y: 0, z: 1 }), true);
    assert.equal(isClickToMoveTargetAllowed(source, { x: 66, y: 0, z: 1 }), false);
    assert.equal(isClickToMoveTargetAllowed(source, { x: 1, y: 10_001, z: 1 }), false);
    assert.equal(isClickToMoveTargetAllowed(source, { x: 1e308, y: 0, z: 1 }), false);
});

test("unexpected gameplay handler errors are contained and disconnect only the sender", () => {
    const reported: unknown[] = [];
    const leaves: Array<{ code?: number; reason?: string }> = [];
    const client = {
        leave: (code?: number, reason?: string) => leaves.push({ code, reason }),
    };
    const state = {
        processMessage: () => {
            throw new TypeError("malformed legacy payload");
        },
    };

    assert.equal(dispatchGameplayMessageSafely(state, client, 123, {}, (error) => reported.push(error)), false);
    assert.equal(reported.length, 1);
    assert.deepEqual(leaves, [
        { code: INVALID_GAMEPLAY_MESSAGE_CLOSE_CODE, reason: "Invalid gameplay message" },
    ]);
});

test("SQLite rolls back partial character creation and persistence as one transaction", async (t) => {
    const previousPath = process.env.DATABASE_PATH;
    process.env.DATABASE_PATH = ":memory:";
    const database = new Database({ database: "sqllite" } as any);
    await database.init();
    await database.create();
    const querier = (database as any).querier;
    t.after(async () => {
        await database.close();
        if (previousPath === undefined) {
            delete process.env.DATABASE_PATH;
        } else {
            process.env.DATABASE_PATH = previousPath;
        }
    });

    await querier.run("INSERT INTO users (`username`, `password`, `token`) VALUES (?,?,?);", ["alice", "hash", "token"]);
    await querier.run(
        "CREATE TRIGGER reject_defaults BEFORE INSERT ON character_inventory BEGIN SELECT RAISE(ABORT, 'forced failure'); END;"
    );
    await assert.rejects(database.createCharacter("token", "Alice", "humanoid", 0, "Head_Base"), /forced failure/);
    assert.equal((await querier.get("SELECT COUNT(*) AS count FROM characters;")).count, 0);

    await querier.run("DROP TRIGGER reject_defaults;");
    const character = await database.createCharacter("token", "Alice", "humanoid", 0, "Head_Base");
    assert.ok(character);
    assert.equal(character.inventory.length, 6);
    assert.equal(character.hotbar.length, 4);
    assert.equal(character.abilities.length, 2);

    await database.toggleOnlineStatus(character.id, 1);
    assert.equal((await database.getCharacter(character.id)).online, 1);
    await database.resetOnlineStatuses();
    assert.equal((await database.getCharacter(character.id)).online, 0);

    await querier.run(
        "CREATE TRIGGER reject_snapshot BEFORE INSERT ON character_hotbar WHEN NEW.key='forced' BEGIN SELECT RAISE(ABORT, 'snapshot failure'); END;"
    );
    const snapshot: PlayerPersistenceSnapshot = {
        location: "training_ground",
        x: 9,
        y: 8,
        z: 7,
        rot: 1,
        level: 2,
        maxHealth: 1000,
        maxMana: 1000,
        player_data: {
            gold: 1,
            experience: 2,
            points: 3,
            strength: 20,
            endurance: 20,
            agility: 20,
            intelligence: 20,
            wisdom: 20,
        },
        inventory: [{ key: "potion_small_red", qty: 1 }],
        abilities: [{ key: "base_attack" }],
        equipment: [{ key: "sword_01", slot: 6 }],
        quests: [],
        hotbar: [{ digit: 1, type: "ability", key: "forced" }],
    };
    await assert.rejects(database.savePlayerSnapshot(character.id, snapshot), /snapshot failure/);

    const unchanged = await database.getCharacter(character.id);
    assert.equal(unchanged.location, "lh_town");
    assert.equal(unchanged.inventory.length, 6);
    assert.equal(unchanged.hotbar.length, 4);

    for (let index = 1; index < MAX_CHARACTERS_PER_USER; index += 1) {
        assert.ok(await database.createCharacter("token", `Alice ${index + 1}`, "humanoid", 0, "Head_Base"));
    }
    await assert.rejects(
        database.createCharacter("token", "Alice Too Many", "humanoid", 0, "Head_Base"),
        CharacterLimitError
    );
    assert.equal((await querier.get("SELECT COUNT(*) AS count FROM characters WHERE user_id=1;")).count, MAX_CHARACTERS_PER_USER);
});
