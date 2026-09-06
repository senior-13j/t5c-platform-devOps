import Logger from "./utils/Logger";
import { DB_MYSQL } from "./utils/database/mysql";
import type { DB_SQLLITE } from "./utils/database/sqllite";
import { nanoid } from "nanoid";
import { PlayerSlots } from "../shared/types";
import type { PlayerCharacter, PlayerUser } from "../shared/types";
import { ParsedQs } from "qs";
import type { InventorySchema } from "./rooms/schema/player/InventorySchema";
import type { AbilitySchema } from "./rooms/schema/player/AbilitySchema";
import type { EquipmentSchema, HotbarSchema, QuestSchema } from "./rooms/schema";
import { MAX_CHARACTERS_PER_USER, type Config } from "../shared/Config";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import type { DatabaseExecutor } from "./utils/database/DatabaseExecutor";
import type { PlayerPersistenceSnapshot } from "./rooms/playerPersistence";
import { STARTER_ABILITY_KEYS } from "./rooms/gameplayRules";

const scrypt = promisify(scryptCallback);
const PASSWORD_PREFIX = "scrypt";
export { MAX_CHARACTERS_PER_USER } from "../shared/Config";

export class CharacterLimitError extends Error {
    constructor() {
        super(`A user may own at most ${MAX_CHARACTERS_PER_USER} characters.`);
        this.name = "CharacterLimitError";
    }
}

export class DuplicateUsernameError extends Error {
    constructor() {
        super("That username already exists.");
        this.name = "DuplicateUsernameError";
    }
}

export function isDuplicateUsernameConstraintError(error: unknown): boolean {
    const candidate = error as { code?: unknown; errno?: unknown; message?: unknown; sqlMessage?: unknown } | null;
    const code = String(candidate?.code ?? "");
    const errno = Number(candidate?.errno);
    const detail = `${String(candidate?.message ?? "")} ${String(candidate?.sqlMessage ?? "")}`;

    if ((code === "ER_DUP_ENTRY" || errno === 1062) && /uq_users_username|users\.username|username_unique/i.test(detail)) {
        return true;
    }

    return code.startsWith("SQLITE_CONSTRAINT") && /unique constraint failed:\s*users\.username/i.test(detail);
}

class Database {
    private debug: boolean = true;
    private _config: Config;
    private querier: DB_MYSQL | DB_SQLLITE;
    private closePromise?: Promise<void>;

    constructor(config) {
        this._config = config;
    }

    async init() {
        Logger.info("[database] Trying to connect to database");

        if (this._config.database === "mysql") {
            this.querier = new DB_MYSQL();
        } else {
            const { DB_SQLLITE } = await import("./utils/database/sqllite");
            this.querier = new DB_SQLLITE();
        }

        await this.querier.init(this._config);

        Logger.info("[database] Connected to database");
    }

    async create() {
        await this.querier.createDatabase();
        Logger.info("[database] database schema ready");
    }

    async close(): Promise<void> {
        if (!this.querier) {
            return;
        }

        if (!this.closePromise) {
            this.closePromise = this.querier.close();
        }
        await this.closePromise;
    }

    ///////////////////////////////////////
    ///////////////////////////////////////
    ///////////////////////////////////////

    async getUser(username: string | string[] | ParsedQs | ParsedQs[], password: string | string[] | ParsedQs | ParsedQs[]) {
        const normalizedUsername = String(username);
        const normalizedPassword = String(password);
        const user = await this.querier.get(`SELECT * FROM users WHERE username=?;`, [normalizedUsername]);

        if (!user || !(await this.verifyPassword(normalizedPassword, user.password))) {
            return null;
        }

        // Upgrade legacy plaintext rows after a successful login.
        if (!String(user.password).startsWith(PASSWORD_PREFIX + "$")) {
            user.password = await this.hashPassword(normalizedPassword);
            await this.querier.run(`UPDATE users SET password=? WHERE id=?;`, [user.password, user.id]);
        }

        return user;
    }

    async getUserWithToken(token: string | string[] | ParsedQs | ParsedQs[]) {
        const sql = `SELECT * FROM users WHERE token=?;`;
        return await this.querier.get(sql, [token]);
    }

    async getUserById(user_id: number): Promise<PlayerUser> {
        const sql = `SELECT * FROM users WHERE id=?;`;
        let user = await (<any>this.querier.get(sql, [user_id]));
        user.characters = await this.getCharactersForUser(user_id);
        return user;
    }

    async getUserByToken(token: any): Promise<PlayerUser> {
        const sql = `SELECT * FROM users WHERE token=?;`;
        return <PlayerUser>await this.querier.get(sql, [token]);
    }

    async getCharactersForUser(user_id: number): Promise<PlayerCharacter[]> {
        const sql = `SELECT * FROM characters WHERE user_id=?;`;
        return <PlayerCharacter[]>await this.querier.all(sql, [user_id]);
    }

    async hasUser(username: string) {
        const sql = `SELECT * FROM users WHERE username=?;`;
        return await this.querier.get(sql, [username]);
    }

    async refreshToken(user_id: number) {
        let token = nanoid();
        const sql = `UPDATE users SET token=? WHERE id=?;`;
        await this.querier.run(sql, [token, user_id]);
        let user = await this.getUserById(user_id);
        return user;
    }

    async checkToken(token: string): Promise<PlayerUser> {
        let user = await this.getUserByToken(token);
        if (user) {
            user.characters = await this.getCharactersForUser(user.id);
            return user;
        }
        return null;
    }

    async saveUser(username: string, password: string, token: string = nanoid()) {
        const passwordHash = await this.hashPassword(password);
        let lastId: number;
        try {
            lastId = Number(
                await this.querier.run(`INSERT INTO users (username, password, token) VALUES (?,?,?)`, [
                    username,
                    passwordHash,
                    token,
                ])
            );
        } catch (error) {
            if (isDuplicateUsernameConstraintError(error)) {
                throw new DuplicateUsernameError();
            }
            throw error;
        }
        if (!Number.isSafeInteger(lastId) || lastId <= 0) {
            throw new Error("Database did not return a valid user ID.");
        }
        return await this.getUserById(lastId);
    }

    private async hashPassword(password: string): Promise<string> {
        const salt = randomBytes(16).toString("hex");
        const derivedKey = (await scrypt(password, salt, 64)) as Buffer;
        return [PASSWORD_PREFIX, salt, derivedKey.toString("hex")].join("$");
    }

    private async verifyPassword(password: string, storedPassword: string): Promise<boolean> {
        const stored = String(storedPassword ?? "");
        const parts = stored.split("$");

        if (parts.length !== 3 || parts[0] !== PASSWORD_PREFIX) {
            const candidate = Buffer.from(password);
            const legacy = Buffer.from(stored);
            return candidate.length === legacy.length && timingSafeEqual(candidate, legacy);
        }

        try {
            const expected = Buffer.from(parts[2], "hex");
            const actual = (await scrypt(password, parts[1], expected.length)) as Buffer;
            return expected.length === actual.length && timingSafeEqual(expected, actual);
        } catch {
            return false;
        }
    }

    ///////////////////////////////////////
    ///////////////////////////////////////
    ///////////////////////////////////////

    async getCharacter(id: number) {
        if (!Number.isSafeInteger(id) || id <= 0) {
            return null;
        }

        const character = await this.querier.get(`SELECT * FROM characters WHERE id=?;`, [id]);
        if (!character) {
            return null;
        }

        character.abilities = await this.querier.all(`SELECT CA.* FROM character_abilities CA WHERE CA.owner_id=? ORDER BY CA.id ASC;`, [id]);
        character.hotbar = await this.querier.all(`SELECT CA.* FROM character_hotbar CA WHERE CA.owner_id=? ORDER BY CA.digit ASC;`, [id]);
        character.inventory = await this.querier.all(`SELECT CI.* FROM character_inventory CI WHERE CI.owner_id=?;`, [id]);
        character.equipment = await this.querier.all(`SELECT CI.* FROM character_equipment CI WHERE CI.owner_id=?;`, [id]);
        character.quests = await this.querier.all(`SELECT CI.* FROM character_quests CI WHERE CI.owner_id=?;`, [id]);
        return character;
    }

    generateStatPoint() {
        return Math.trunc(70 / 5 + Math.random() * 10);
    }

    async createCharacter(token, name, race, material, head) {
        const characterId = await this.querier.transaction(async (executor) => {
            // Lock the owning row in MySQL so concurrent server processes
            // cannot both pass the character-count check. SQLite transactions
            // already start with BEGIN IMMEDIATE and serialize writers.
            const userSql = this._config.database === "mysql"
                ? `SELECT * FROM users WHERE token=? FOR UPDATE;`
                : `SELECT * FROM users WHERE token=?;`;
            const user = await executor.get(userSql, [token]);
            if (!user || !Number.isSafeInteger(Number(user.id)) || Number(user.id) <= 0) {
                return null;
            }

            const characterCount = Number(
                (await executor.get(`SELECT COUNT(*) AS count FROM characters WHERE user_id=?;`, [user.id]))?.count
            );
            if (!Number.isSafeInteger(characterCount) || characterCount < 0) {
                throw new Error("Database returned an invalid character count.");
            }
            if (characterCount >= MAX_CHARACTERS_PER_USER) {
                throw new CharacterLimitError();
            }

            const createdCharacterId = Number(
                await executor.run(
                    `INSERT INTO characters (
                    user_id, 
                    name, 
                    race, 
                    material, 
                    head, 
                    strength, 
                    endurance, 
                    agility, 
                    intelligence, 
                    wisdom, 
                    location, 
                    x, 
                    y, 
                    z, 
                    rot, 
                    level, 
                    experience, 
                    health, 
                    mana, 
                    gold, 
                    points 
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
                `,
                    [
                        user.id,
                        name,
                        race,
                        material,
                        head,
                        20,
                        20,
                        20,
                        20,
                        20,
                        "lh_town",
                        6.18,
                        0.1,
                        -11.21,
                        1.72,
                        1,
                        0,
                        1000,
                        1000,
                        50000,
                        50,
                    ]
                )
            );
            if (!Number.isSafeInteger(createdCharacterId) || createdCharacterId <= 0) {
                throw new Error("Database did not return a valid character ID.");
            }

            const abilities = STARTER_ABILITY_KEYS.map((key) => ({ key }));
            for (const ability of abilities) {
                await executor.run("INSERT INTO character_abilities (`owner_id`, `key`) VALUES (?,?);", [
                    createdCharacterId,
                    ability.key,
                ]);
            }

            const hotbar = [
                { digit: 1, type: "ability", key: "base_attack" },
                { digit: 2, type: "ability", key: "slice_attack" },
                { digit: 8, type: "item", key: "potion_small_red" },
                { digit: 9, type: "item", key: "potion_small_blue" },
            ];
            for (const item of hotbar) {
                await executor.run(
                    "INSERT INTO character_hotbar (`owner_id`, `digit`, `type`, `key`) VALUES (?,?,?,?);",
                    [createdCharacterId, item.digit, item.type, item.key]
                );
            }

            await executor.run("INSERT INTO character_equipment (`owner_id`,`slot`, `key`) VALUES (?,?,?) ", [
                createdCharacterId,
                PlayerSlots.WEAPON,
                "sword_01",
            ]);

            const items = [
                { qty: 5, key: "potion_small_red" },
                { qty: 5, key: "potion_small_blue" },
                { qty: 1, key: "sword_01" },
                { qty: 1, key: "armor_01" },
                { qty: 1, key: "armor_02" },
                { qty: 1, key: "amulet_01" },
            ];
            for (const item of items) {
                await executor.run("INSERT INTO character_inventory (`owner_id`, `qty`, `order`, `key`) VALUES (?,?,?,?)", [
                    createdCharacterId,
                    item.qty,
                    1,
                    item.key,
                ]);
            }

            return createdCharacterId;
        });

        return characterId === null ? null : this.getCharacter(characterId);
    }

    async savePlayerSnapshot(characterId: number, snapshot: PlayerPersistenceSnapshot): Promise<void> {
        await this.querier.transaction(async (executor) => {
            await this.updateCharacterWith(executor, characterId, snapshot);
            await this.saveItemsWith(executor, characterId, snapshot.inventory);
            await this.saveAbilitiesWith(executor, characterId, snapshot.abilities);
            await this.saveEquipmentWith(executor, characterId, snapshot.equipment);
            await this.saveQuestsWith(executor, characterId, snapshot.quests);
            await this.saveHotbarWith(executor, characterId, snapshot.hotbar);
        });
    }

    async updateCharacter(character_id: number, data) {
        return this.updateCharacterWith(this.querier, character_id, data);
    }

    private async updateCharacterWith(executor: DatabaseExecutor, character_id: number, data) {
        const playerData = data?.player_data ?? {};
        const sql = `UPDATE characters SET
            location=?, x=?, y=?, z=?, rot=?, level=?, health=?, mana=?,
            gold=?, experience=?, points=?, strength=?, endurance=?, agility=?, intelligence=?, wisdom=?
            WHERE id=?;`;
        return executor.run(sql, [
            data.location,
            data.x,
            data.y,
            data.z,
            data.rot,
            data.level,
            data.maxHealth,
            data.maxMana,
            playerData.gold ?? 0,
            playerData.experience ?? 0,
            playerData.points ?? 0,
            playerData.strength ?? 0,
            playerData.endurance ?? 0,
            playerData.agility ?? 0,
            playerData.intelligence ?? 0,
            playerData.wisdom ?? 0,
            character_id,
        ]);
    }

    // removes and saves character hotbar
    // terrible way to do it
    async saveHotbar(character_id: number, hotbar: ReadonlyArray<Pick<HotbarSchema, "digit" | "type" | "key">>) {
        return this.saveHotbarWith(this.querier, character_id, hotbar);
    }

    private async saveHotbarWith(
        executor: DatabaseExecutor,
        character_id: number,
        hotbar: ReadonlyArray<Pick<HotbarSchema, "digit" | "type" | "key">>
    ) {
        const sql = `DELETE FROM character_hotbar WHERE owner_id=?;`;
        await executor.run(sql, [character_id]);
        if (hotbar?.length > 0) {
            for (const item of hotbar) {
                await executor.run("INSERT INTO character_hotbar (`owner_id`, `digit`, `type`, `key`) VALUES (?,?,?,?);", [
                    character_id,
                    item.digit,
                    item.type,
                    item.key,
                ]);
            }
        }
    }

    // removes and saves character items
    // terrible way to do it
    async saveItems(character_id: number, items: ReadonlyArray<Pick<InventorySchema, "qty" | "key">>) {
        return this.saveItemsWith(this.querier, character_id, items);
    }

    private async saveItemsWith(
        executor: DatabaseExecutor,
        character_id: number,
        items: ReadonlyArray<Pick<InventorySchema, "qty" | "key">>
    ) {
        const sql = `DELETE FROM character_inventory WHERE owner_id=?;`;
        await executor.run(sql, [character_id]);
        if (items?.length > 0) {
            for (const item of items) {
                await executor.run(
                    "INSERT INTO character_inventory (`owner_id`, `qty`, `key`) VALUES (?,?,?);",
                    [character_id, item.qty, item.key]
                );
            }
        }
    }

    // removes and saves character abilities
    // terrible way to do it
    async saveAbilities(character_id: number, abilities: ReadonlyArray<Pick<AbilitySchema, "key">>) {
        return this.saveAbilitiesWith(this.querier, character_id, abilities);
    }

    private async saveAbilitiesWith(
        executor: DatabaseExecutor,
        character_id: number,
        abilities: ReadonlyArray<Pick<AbilitySchema, "key">>
    ) {
        const sql = `DELETE FROM character_abilities WHERE owner_id=?;`;
        await executor.run(sql, [character_id]);
        if (abilities?.length > 0) {
            for (const ability of abilities) {
                await executor.run("INSERT INTO character_abilities (`owner_id`, `key`) VALUES (?,?);", [
                    character_id,
                    ability.key,
                ]);
            }
        }
    }

    // removes and saves character equipment
    // terrible way to do it
    async saveEquipment(character_id: number, equipments: ReadonlyArray<Pick<EquipmentSchema, "key" | "slot">>) {
        return this.saveEquipmentWith(this.querier, character_id, equipments);
    }

    private async saveEquipmentWith(
        executor: DatabaseExecutor,
        character_id: number,
        equipments: ReadonlyArray<Pick<EquipmentSchema, "key" | "slot">>
    ) {
        const sql = `DELETE FROM character_equipment WHERE owner_id=?;`;
        await executor.run(sql, [character_id]);
        if (equipments?.length > 0) {
            for (const equipment of equipments) {
                await executor.run("INSERT INTO character_equipment (`owner_id`, `key`, `slot`) VALUES (?,?,?);", [
                    character_id,
                    equipment.key,
                    equipment.slot,
                ]);
            }
        }
    }

    // removes and saves quests
    // terrible way to do it
    async saveQuests(character_id: number, quests: ReadonlyArray<Pick<QuestSchema, "key" | "status" | "qty">>) {
        return this.saveQuestsWith(this.querier, character_id, quests);
    }

    private async saveQuestsWith(
        executor: DatabaseExecutor,
        character_id: number,
        quests: ReadonlyArray<Pick<QuestSchema, "key" | "status" | "qty">>
    ) {
        const sql = `DELETE FROM character_quests WHERE owner_id=?;`;
        await executor.run(sql, [character_id]);
        if (quests?.length > 0) {
            for (const quest of quests) {
                await executor.run("INSERT INTO character_quests (`owner_id`, `key`, `status`, `qty`) VALUES (?,?,?,?);", [
                    character_id,
                    quest.key,
                    quest.status,
                    quest.qty,
                ]);
            }
        }
    }

    async toggleOnlineStatus(character_id: number, online: number) {
        const sql = `UPDATE characters SET online=? WHERE id=? ;`;
        return this.querier.run(sql, [online, character_id]);
    }

    async resetOnlineStatuses(): Promise<void> {
        // The supported deployment topology has one game-server process. A
        // process crash cannot run room leave hooks, so recover its durable
        // presence markers before accepting connections after a restart.
        await this.querier.run(`UPDATE characters SET online=0 WHERE online<>0;`);
    }

    async doesUserNameExists(name: string) {
        const sql = `SELECT COUNT(id) as count FROM users WHERE username=? ;`;
        return this.querier.get(sql, [name]);
    }
}

export { Database };
