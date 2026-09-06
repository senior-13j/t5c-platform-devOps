import fs from "fs";
import sqlite3 from "sqlite3";
import Logger from "../Logger";
import type { DatabaseExecutor } from "./DatabaseExecutor";

export class DB_SQLLITE {
    db;
    private operationQueue: Promise<void> = Promise.resolve();

    constructor() {}

    async init(_config) {
        const dbFilePath = process.env.DATABASE_PATH || "./database.db";
        await new Promise<void>((resolve, reject) => {
            this.db = new sqlite3.Database(dbFilePath, (error: Error | null) => {
                if (error) {
                    Logger.error("[database] Could not connect to database: " + dbFilePath, error);
                    reject(error);
                } else {
                    Logger.info("[database] Connected to database: " + dbFilePath);
                    resolve();
                }
            });
        });
    }

    async createDatabase() {
        const tables = await this.all("SELECT name FROM sqlite_master WHERE type='table' AND name='users';");
        if (tables.length > 0) {
            Logger.info("[database] sqlite schema already exists, skipping import");
            return;
        }

        const sql = fs.readFileSync("./database/sqllite.sql", { encoding: "utf8" });
        const splitCharacter = ");";
        const statements = sql.toString().split(splitCharacter);

        await this.run("PRAGMA foreign_keys=OFF;");
        await this.transaction(async (executor) => {
            for (let statement of statements) {
                if (statement.trim()) {
                    statement += splitCharacter;
                    await executor.run(statement);
                }
            }
        });
    }

    async query(sql: string, params = []): Promise<any> {
        return this.all(sql, params);
    }

    async get(sql: string, params = []): Promise<any> {
        return this.enqueue(() => this.rawGet(sql, params));
    }

    async all(sql: string, params = []): Promise<any[]> {
        return this.enqueue(() => this.rawAll(sql, params));
    }

    async run(sql: string, params = []): Promise<number> {
        return this.enqueue(() => this.rawRun(sql, params));
    }

    async transaction<T>(work: (executor: DatabaseExecutor) => Promise<T>): Promise<T> {
        return this.enqueue(async () => {
            await this.rawRun("BEGIN IMMEDIATE TRANSACTION;");
            const executor = this.rawExecutor();
            try {
                const result = await work(executor);
                await this.rawRun("COMMIT;");
                return result;
            } catch (error) {
                try {
                    await this.rawRun("ROLLBACK;");
                } catch (rollbackError) {
                    Logger.error("[database] sqlite transaction rollback failed", rollbackError);
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
            await new Promise<void>((resolve, reject) => {
                connection.close((error: Error | null) => (error ? reject(error) : resolve()));
            });
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
            query: (sql, params = []) => this.rawAll(sql, params),
            get: (sql, params = []) => this.rawGet(sql, params),
            all: (sql, params = []) => this.rawAll(sql, params),
            run: (sql, params = []) => this.rawRun(sql, params),
        };
    }

    private rawGet(sql: string, params: any[] = []): Promise<any> {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (error: Error | null, result: any) => (error ? reject(error) : resolve(result)));
        });
    }

    private rawAll(sql: string, params: any[] = []): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (error: Error | null, rows: any[]) => (error ? reject(error) : resolve(rows)));
        });
    }

    private rawRun(sql: string, params: any[] = []): Promise<number> {
        const database = this.db;
        return new Promise((resolve, reject) => {
            database.run(sql, params, function (error: Error | null) {
                if (error) {
                    reject(error);
                } else {
                    resolve(this.lastID);
                }
            });
        });
    }
}
