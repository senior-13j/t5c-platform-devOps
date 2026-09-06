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
import type { Config } from "../shared/Config";
import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const PASSWORD_PREFIX = "scrypt";

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
        let lastId = await this.querier.run(`INSERT INTO users (username, password, token) VALUES (?,?,?)`, [username, passwordHash, token]);
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
        const user = await this.getUserByToken(token);
        if (!user || !Number.isSafeInteger(Number(user.id)) || Number(user.id) <= 0) {
            return null;
        }

        let characterId = await (<any>this.querier.run(
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
                //"training_ground",
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
        ));

        // add default abilities
        let abilities = [{ key: "base_attack" }, { key: "fire_dart" }];
        for (const ability of abilities) {
            await this.querier.run("INSERT INTO character_abilities (`owner_id`, `key`) VALUES (?,?);", [characterId, ability.key]);
        }

        // add default hotbar
        let hotbar = [
            { digit: 1, type: "ability", key: "base_attack" },
            { digit: 2, type: "ability", key: "slice_attack" },
            { digit: 3, type: "ability", key: "fire_dart" },
            { digit: 4, type: "ability", key: "poison" },
            { digit: 5, type: "ability", key: "light_heal" },
            { digit: 8, type: "item", key: "potion_small_red" },
            { digit: 9, type: "item", key: "potion_small_blue" },
        ];
        for (const item of hotbar) {
            await this.querier.run("INSERT INTO character_hotbar (`owner_id`, `digit`, `type`, `key`) VALUES (?,?,?,?);", [
                characterId,
                item.digit,
                item.type,
                item.key,
            ]);
        }

        // default equipment
        let equipment = [{ key: "sword_01", slot: PlayerSlots.WEAPON }];
        for (const e of equipment) {
            await this.querier.run("INSERT INTO character_equipment (`owner_id`,`slot`, `key`) VALUES (?,?,?) ", [characterId, e.slot, e.key]);
        }

        // default quests
        //const sql_quests = `INSERT INTO character_quests ("owner_id", "key", "status", "qty") VALUES ("${c.id}", "LH_DANGEROUS_ERRANDS_01", "0", "5")`;
        //this.run(sql_quests);

        // add default items
        let items = [
            { qty: 5, key: "potion_small_red" },
            { qty: 5, key: "potion_small_blue" },
            //{ qty: 1, key: "cape_01" },
            { qty: 1, key: "sword_01" },
            { qty: 1, key: "armor_01" },
            { qty: 1, key: "armor_02" },
            { qty: 1, key: "amulet_01" },
        ];
        for (const item of items) {
            const sql = "INSERT INTO character_inventory (`owner_id`, `qty`, `order`, `key`) VALUES (?,?,?,?)";
            await this.querier.run(sql, [characterId, item.qty, 1, item.key]);
        }

        return await this.getCharacter(characterId);
    }

    async updateCharacter(character_id: number, data) {
        const playerData = data?.player_data ?? {};
        const sql = `UPDATE characters SET
            location=?, x=?, y=?, z=?, rot=?, level=?, health=?, mana=?,
            gold=?, experience=?, points=?, strength=?, endurance=?, agility=?, intelligence=?, wisdom=?
            WHERE id=?;`;
        return this.querier.run(sql, [
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
        const sql = `DELETE FROM character_hotbar WHERE owner_id=?;`;
        await this.querier.run(sql, [character_id]);
        if (hotbar?.length > 0) {
            for (const item of hotbar) {
                await this.querier.run("INSERT INTO character_hotbar (`owner_id`, `digit`, `type`, `key`) VALUES (?,?,?,?);", [
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
        const sql = `DELETE FROM character_inventory WHERE owner_id=?;`;
        await this.querier.run(sql, [character_id]);
        if (items?.length > 0) {
            for (const item of items) {
                await this.querier.run(
                    "INSERT INTO character_inventory (`owner_id`, `qty`, `key`) VALUES (?,?,?);",
                    [character_id, item.qty, item.key]
                );
            }
        }
    }

    // removes and saves character abilities
    // terrible way to do it
    async saveAbilities(character_id: number, abilities: ReadonlyArray<Pick<AbilitySchema, "key">>) {
        const sql = `DELETE FROM character_abilities WHERE owner_id=?;`;
        await this.querier.run(sql, [character_id]);
        if (abilities?.length > 0) {
            for (const ability of abilities) {
                await this.querier.run("INSERT INTO character_abilities (`owner_id`, `key`) VALUES (?,?);", [
                    character_id,
                    ability.key,
                ]);
            }
        }
    }

    // removes and saves character equipment
    // terrible way to do it
    async saveEquipment(character_id: number, equipments: ReadonlyArray<Pick<EquipmentSchema, "key" | "slot">>) {
        const sql = `DELETE FROM character_equipment WHERE owner_id=?;`;
        await this.querier.run(sql, [character_id]);
        if (equipments?.length > 0) {
            for (const equipment of equipments) {
                await this.querier.run("INSERT INTO character_equipment (`owner_id`, `key`, `slot`) VALUES (?,?,?);", [
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
        const sql = `DELETE FROM character_quests WHERE owner_id=?;`;
        await this.querier.run(sql, [character_id]);
        if (quests?.length > 0) {
            for (const quest of quests) {
                await this.querier.run("INSERT INTO character_quests (`owner_id`, `key`, `status`, `qty`) VALUES (?,?,?,?);", [
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

    async doesUserNameExists(name: string) {
        const sql = `SELECT COUNT(id) as count FROM users WHERE username=? ;`;
        return this.querier.get(sql, [name]);
    }
}

export { Database };
