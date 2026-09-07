import Logger from "../Logger";
import fs from "fs";

import mysql from "mysql2/promise";
import type { DatabaseExecutor } from "./DatabaseExecutor";

type UsernameIndexRow = {
    index_name: string;
    non_unique: number | string;
    sequence: number | string;
    column_name: string;
};

export function hasSingleColumnUniqueUsernameIndex(rows: UsernameIndexRow[]): boolean {
    const indexes = new Map<string, UsernameIndexRow[]>();
    for (const row of rows) {
        const name = String(row.index_name ?? "");
        if (!name) {
            continue;
        }
        const entries = indexes.get(name) ?? [];
        entries.push(row);
        indexes.set(name, entries);
    }

    return [...indexes.values()].some(
        (entries) =>
            entries.length === 1 &&
            Number(entries[0].non_unique) === 0 &&
            Number(entries[0].sequence) === 1 &&
            String(entries[0].column_name).toLowerCase() === "username"
    );
}

export class DB_MYSQL {
    db;
    private operationQueue: Promise<void> = Promise.resolve();

    constructor() {}

    async init(config) {
        this.db = await mysql.createConnection({
            host: process.env.DATABASE_HOST,
            database: process.env.DATABASE_DB,
            user: process.env.DATABASE_USER,
            password: process.env.DATABASE_PASSWORD,
            decimalNumbers: true,
        });
        Logger.info("[database] Connected to database");
    }

    // create tables in database
    async createDatabase() {
        const tables = await this.all("SHOW TABLES LIKE 'users';");
        if (tables.length === 0) {
            const sql = fs.readFileSync("./database/mysql.sql", { encoding: "utf8" });
            const splitCharacter = ";";
            const dataArr = sql.toString().split(splitCharacter);
            for (let query of dataArr) {
                if (query.trim()) {
                    query += splitCharacter;
                    await this.query(query, []);
                }
            }
        } else {
            Logger.info("[database] mysql schema already exists, skipping import");
        }

        // Bootstrap files do not run again for existing installations. Keep
        // this migration idempotent so every startup verifies the durable
        // identity invariant before accepting logins.
        await this.ensureUniqueUsername();
    }

    private async ensureUniqueUsername(): Promise<void> {
        const invalidUsername = await this.get(
            `SELECT id FROM users
             WHERE username IS NULL OR username='' OR CHAR_LENGTH(username)>255
             ORDER BY id ASC LIMIT 1;`
        );
        if (invalidUsername) {
            throw new Error(
                `[database] Cannot secure usernames: user row ${Number(invalidUsername.id) || "unknown"} has a null, empty, or overlong username. ` +
                    "Back up the database and repair that row before restarting."
            );
        }

        const duplicate = await this.get(
            `SELECT MIN(id) AS first_id, MAX(id) AS last_id, COUNT(*) AS duplicate_count
             FROM users GROUP BY username HAVING COUNT(*)>1 LIMIT 1;`
        );
        if (duplicate) {
            throw new Error(
                `[database] Cannot add unique usernames: ${Number(duplicate.duplicate_count) || "multiple"} rows between IDs ` +
                    `${Number(duplicate.first_id) || "unknown"} and ${Number(duplicate.last_id) || "unknown"} share one username. ` +
                    "Back up the database, then manually rename or resolve ownership of every duplicate before restarting; rows are never merged automatically."
            );
        }

        const columns = await this.all(
            `SELECT DATA_TYPE AS data_type,
                    CHARACTER_MAXIMUM_LENGTH AS max_length,
                    IS_NULLABLE AS is_nullable
             FROM information_schema.columns
             WHERE table_schema=DATABASE() AND table_name='users' AND column_name='username';`
        );
        if (columns.length !== 1) {
            throw new Error("[database] Cannot secure usernames: users.username is missing or ambiguous.");
        }

        const indexes = (await this.all(
            `SELECT INDEX_NAME AS index_name,
                    NON_UNIQUE AS non_unique,
                    SEQ_IN_INDEX AS sequence,
                    COLUMN_NAME AS column_name
             FROM information_schema.statistics
             WHERE table_schema=DATABASE() AND table_name='users'
             ORDER BY INDEX_NAME, SEQ_IN_INDEX;`
        )) as UsernameIndexRow[];

        const column = columns[0];
        const clauses: string[] = [];
        if (
            String(column.data_type).toLowerCase() !== "varchar" ||
            Number(column.max_length) !== 255 ||
            String(column.is_nullable).toUpperCase() !== "NO"
        ) {
            clauses.push("MODIFY `username` varchar(255) NOT NULL");
        }
        if (!hasSingleColumnUniqueUsernameIndex(indexes)) {
            clauses.push("ADD UNIQUE KEY `uq_users_username` (`username`)");
        }

        if (clauses.length > 0) {
            await this.query(`ALTER TABLE \`users\` ${clauses.join(", ")};`);
            Logger.info("[database] applied unique username migration");
        }
    }

    async query(sql: string, params = []) {
        return this.enqueue(() => this.rawQuery(sql, params));
    }

    async get(sql: string, params = []) {
        return this.enqueue(() => this.rawGet(sql, params));
    }

    async all(sql: string, params = []) {
        return this.enqueue(() => this.rawAll(sql, params));
    }

    async run(sql: string, params: any[] = []) {
        return this.enqueue(() => this.rawRun(sql, params));
    }

    async transaction<T>(work: (executor: DatabaseExecutor) => Promise<T>): Promise<T> {
        return this.enqueue(async () => {
            await this.db.beginTransaction();
            const executor = this.rawExecutor();
            try {
                const result = await work(executor);
                await this.db.commit();
                return result;
            } catch (error) {
                try {
                    await this.db.rollback();
                } catch (rollbackError) {
                    Logger.error("[database] mysql transaction rollback failed", rollbackError);
                }
                throw error;
            }
        });
    }

    async close(): Promise<void> {
        return this.enqueue(async () => {
            if (!this.db) {
                return;
            }

            const connection = this.db;
            this.db = undefined;
            await connection.end();
        });
    }

    private enqueue<T>(operation: () => Promise<T>): Promise<T> {
        const result = this.operationQueue.then(operation, operation);
        this.operationQueue = result.then(
            () => undefined,
            () => undefined
        );
        return result;
    }

    private rawExecutor(): DatabaseExecutor {
        return {
            query: (sql, params = []) => this.rawQuery(sql, params),
            get: (sql, params = []) => this.rawGet(sql, params),
            all: (sql, params = []) => this.rawAll(sql, params),
            run: (sql, params = []) => this.rawRun(sql, params),
        };
    }

    private async rawQuery(sql: string, params: any[] = []): Promise<any> {
        const [results] = await this.db.query(sql, params);
        return results;
    }

    private async rawGet(sql: string, params: any[] = []): Promise<any> {
        const [result] = await this.db.query(sql, params);
        return result[0];
    }

    private async rawAll(sql: string, params: any[] = []): Promise<any[]> {
        const [result] = await this.db.execute(sql, params);
        return result as any[];
    }

    private async rawRun(sql: string, params: any[] = []): Promise<any> {
        const [result] = await this.db.execute(sql, params);
        return (result as any).insertId;
    }
}
