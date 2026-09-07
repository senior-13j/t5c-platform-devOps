import express from "express";
import path from "path";
import Logger from "./utils/Logger";
import { generateRandomPlayerName } from "../shared/Utils";
import { GameData } from "./GameData";
import { CharacterLimitError, DuplicateUsernameError, type Database } from "./Database";
import { nanoid } from "nanoid";

export const QUICK_PLAY_RATE_LIMIT_COUNT = 5;
export const QUICK_PLAY_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
export const QUICK_PLAY_USERNAME_ATTEMPTS = 20;
export const LOGIN_RATE_LIMIT_COUNT = 10;
export const LOGIN_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
export const CHARACTER_CREATE_RATE_LIMIT_COUNT = 5;
export const CHARACTER_CREATE_RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
export const CHARACTER_NAME_MAX_LENGTH = 24;

export type ValidCharacterCustomization = {
    name: string;
    race: string;
    material: number;
    head: string;
};

export function validateCharacterCustomization(
    nameValue: unknown,
    raceValue: unknown,
    materialValue: unknown,
    headValue: unknown
): ValidCharacterCustomization | null {
    const name = typeof nameValue === "string" ? nameValue.trim().replace(/\s+/g, " ") : "";
    const nameLength = Array.from(name).length;
    const safeName = /^[\p{L}\p{N}](?:[\p{L}\p{N} '-]*[\p{L}\p{N}])?$/u;
    if (!name || nameLength > CHARACTER_NAME_MAX_LENGTH || !safeName.test(name)) {
        return null;
    }

    const raceKey = typeof raceValue === "string" ? raceValue.trim() : "";
    const race = raceKey ? GameData.get("race", raceKey) : null;
    if (!race || race.customizable !== true || !Array.isArray(race.materials)) {
        return null;
    }

    const material =
        typeof materialValue === "number"
            ? materialValue
            : typeof materialValue === "string" && /^\d+$/.test(materialValue.trim())
              ? Number(materialValue)
              : Number.NaN;
    if (!Number.isSafeInteger(material) || material < 0 || material >= race.materials.length) {
        return null;
    }

    const head = typeof headValue === "string" ? headValue.trim() : "";
    const allowedHeads = race.vat?.meshes?.HEAD;
    if (!head || !Array.isArray(allowedHeads) || !allowedHeads.includes(head)) {
        return null;
    }

    return { name, race: raceKey, material, head };
}

export class FixedWindowRateLimiter {
    private windows = new Map<string, { count: number; resetAt: number }>();
    private operations = 0;

    constructor(
        private readonly limit: number,
        private readonly windowMs: number
    ) {}

    allow(key: string, now: number = Date.now()): boolean {
        if (!key) {
            return false;
        }

        this.operations += 1;
        if (this.operations % 1000 === 0 || this.windows.size >= 10_000) {
            this.windows.forEach((window, storedKey) => {
                if (now >= window.resetAt) {
                    this.windows.delete(storedKey);
                }
            });
        }

        // Keep the limiter itself bounded under a distributed-source flood.
        if (!this.windows.has(key) && this.windows.size >= 10_000) {
            return false;
        }

        const current = this.windows.get(key);
        if (!current || now >= current.resetAt) {
            this.windows.set(key, { count: 1, resetAt: now + this.windowMs });
            return true;
        }

        if (current.count >= this.limit) {
            return false;
        }

        current.count += 1;
        return true;
    }
}

export async function findAvailableRandomUsername(
    doesUserNameExists: (username: string) => Promise<{ count: number | string }>,
    generateName: () => string = generateRandomPlayerName,
    maximumAttempts: number = QUICK_PLAY_USERNAME_ATTEMPTS
): Promise<string | null> {
    for (let attempt = 0; attempt < maximumAttempts; attempt += 1) {
        const candidate = String(generateName() ?? "").trim();
        if (!candidate) {
            continue;
        }

        const existing = await doesUserNameExists(candidate);
        if (Number(existing?.count) === 0) {
            return candidate;
        }
    }

    return null;
}

class Api {
    constructor(
        app,
        database: Database,
        options: {
            quickPlayRateLimiter?: FixedWindowRateLimiter;
            loginRateLimiter?: FixedWindowRateLimiter;
            characterCreateRateLimiter?: FixedWindowRateLimiter;
        } = {}
    ) {
        const quickPlayRateLimiter =
            options.quickPlayRateLimiter ??
            new FixedWindowRateLimiter(QUICK_PLAY_RATE_LIMIT_COUNT, QUICK_PLAY_RATE_LIMIT_WINDOW_MS);
        const loginRateLimiter =
            options.loginRateLimiter ?? new FixedWindowRateLimiter(LOGIN_RATE_LIMIT_COUNT, LOGIN_RATE_LIMIT_WINDOW_MS);
        const characterCreateRateLimiter =
            options.characterCreateRateLimiter ??
            new FixedWindowRateLimiter(CHARACTER_CREATE_RATE_LIMIT_COUNT, CHARACTER_CREATE_RATE_LIMIT_WINDOW_MS);
        const requestValue = (req, key: string) => req.body?.[key] ?? req.query?.[key];
        const requestIp = (req) => String(req.ip ?? req.socket?.remoteAddress ?? "unknown");
        const safeUser = (user) => {
            const result = { ...user };
            delete result.password;
            return result;
        };

        app.get("/health", (req, res) => {
            res.send({
                status: "ok",
                uptime: process.uptime(),
            });
        });

        app.get("/metrics", (req, res) => {
            res.type("text/plain").send(
                [
                    "# HELP t5c_server_uptime_seconds Server uptime in seconds.",
                    "# TYPE t5c_server_uptime_seconds gauge",
                    `t5c_server_uptime_seconds ${process.uptime()}`,
                    "# HELP t5c_server_memory_rss_bytes Resident set size in bytes.",
                    "# TYPE t5c_server_memory_rss_bytes gauge",
                    `t5c_server_memory_rss_bytes ${process.memoryUsage().rss}`,
                    "",
                ].join("\n")
            );
        });

        // default to built client index.html
        let indexPath = "dist/client/";
        let clientFile = "index.html";

        // serve client
        let indexFile = path.resolve(indexPath + clientFile);
        let docsIndexFile = path.resolve(indexPath + "docs/index.html");
        app.get(/^\/docs$/, function (req, res) {
            res.redirect(301, "docs/");
        });
        app.get(/^\/docs\/$/, function (req, res) {
            res.sendFile(docsIndexFile);
        });

        app.use(
            express.static(indexPath, {
                setHeaders: (res, filePath) => {
                    if (/\.(?:html|xml|txt|webmanifest|js)$/i.test(filePath) && /(?:index\.html|sw\.js|robots\.txt|sitemap\.xml|manifest\.webmanifest)$/i.test(filePath)) {
                        res.setHeader("Cache-Control", "no-cache");
                    } else {
                        res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
                    }
                },
            })
        );
        app.get("/", function (req, res) {
            res.sendFile(indexFile);
        });

        //////////////////////////////////////////////////
        ///////////// ESPRESS MINI API ///////////////////
        //////////////////////////////////////////////////
        app.post("/login", async (req, res) => {
            if (!loginRateLimiter.allow(requestIp(req))) {
                res.setHeader("Retry-After", Math.ceil(LOGIN_RATE_LIMIT_WINDOW_MS / 1000));
                return res.status(429).send({ message: "Too Many Login Attempts" });
            }

            const username = String(requestValue(req, "username") ?? "").trim().slice(0, 64);
            const password = String(requestValue(req, "password") ?? "").slice(0, 128);
            if (!username || !password) {
                Logger.error("[api][/login] login failed.");
                return res.status(400).send({
                    message: "Wrong Parameters",
                });
            }

            try {
                Logger.info("[api][/login] checking password.");
                let user = await database.getUser(username, password);

                if (!user) {
                    const existingUser = await database.hasUser(username);
                    if (existingUser) {
                        // Another request may have created this account after
                        // our first lookup. Recheck the password so concurrent
                        // first logins with identical credentials converge on
                        // the one durable row instead of producing a false 401.
                        user = await database.getUser(username, password);
                        if (!user) {
                            Logger.info("[api][/login] invalid credentials.");
                            return res.status(401).send({ message: "Invalid Credentials" });
                        }
                        user = await database.getUserById(user.id);
                    } else {
                        Logger.info("[api][/login] user not found, creating new user.");
                        try {
                            user = await database.saveUser(username, password);
                        } catch (error) {
                            if (!(error instanceof DuplicateUsernameError)) {
                                throw error;
                            }

                            // The database unique key is the final arbiter
                            // across processes. A matching concurrent creator
                            // shares its current token; a different password
                            // remains an ordinary invalid-credentials result.
                            const concurrentUser = await database.getUser(username, password);
                            if (!concurrentUser) {
                                Logger.info("[api][/login] invalid credentials after concurrent account creation.");
                                return res.status(401).send({ message: "Invalid Credentials" });
                            }
                            user = await database.getUserById(concurrentUser.id);
                        }
                    }
                } else {
                    Logger.info("[api][/login] user found, refreshing login token.");
                    user = await database.refreshToken(user.id);
                }

                Logger.info("[api][/login] login successful.");
                return res.send({
                    message: "Login Successful",
                    user: safeUser(user),
                });
            } catch (error) {
                Logger.error("[api][/login] request failed.", error);
                return res.status(500).send({ message: "Login Failed" });
            }
        });

        app.all("/loginWithToken", async (req, res) => {
            const token = String(requestValue(req, "token") ?? "").trim().slice(0, 256);
            if (!token) {
                return res.status(400).send({ message: "Missing Token" });
            }

            try {
                Logger.info("[api][/loginWithToken] checking token.");
                const tokenUser = await database.getUserWithToken(token);
                if (!tokenUser) {
                    Logger.info("[api][/loginWithToken] invalid token.");
                    return res.status(401).send({ message: "Invalid Token" });
                }

                Logger.info("[api][/loginWithToken] valid token, refreshing login token.");
                const user = await database.refreshToken(tokenUser.id);
                Logger.info("[api][/loginWithToken] login successful.");
                return res.send({
                    message: "Login Successful",
                    user: safeUser(user),
                });
            } catch (error) {
                Logger.error("[api][/loginWithToken] request failed.", error);
                return res.status(500).send({ message: "Login Failed" });
            }
        });

        app.post("/check", async (req, res) => {
            const token = String(requestValue(req, "token") ?? "").trim().slice(0, 256);
            if (!token) {
                return res.status(400).send({
                    message: "Check Failed",
                });
            }

            try {
                const user = await database.checkToken(token);
                if (!user) {
                    return res.status(400).send({ message: "Check Failed" });
                }
                return res.send({
                    message: "Check Successful",
                    user: safeUser(user),
                });
            } catch (error) {
                Logger.error("[api][/check] request failed.", error);
                return res.status(500).send({ message: "Check Failed" });
            }
        });

        app.post("/create_character", async (req, res) => {
            if (!characterCreateRateLimiter.allow(requestIp(req))) {
                res.setHeader("Retry-After", Math.ceil(CHARACTER_CREATE_RATE_LIMIT_WINDOW_MS / 1000));
                return res.status(429).send({ message: "Too Many Character Creation Requests" });
            }

            const token = String(requestValue(req, "token") ?? "").trim().slice(0, 256);
            if (!token) {
                return res.status(400).send({ message: "Missing Token" });
            }

            const customization = validateCharacterCustomization(
                requestValue(req, "name"),
                requestValue(req, "race"),
                requestValue(req, "material"),
                requestValue(req, "head")
            );
            if (!customization) {
                return res.status(400).send({ message: "Invalid Character Parameters" });
            }

            try {
                const user = await database.getUserByToken(token);
                if (!user) {
                    return res.status(401).send({ message: "Invalid Token" });
                }

                const character = await database.createCharacter(
                    token,
                    customization.name,
                    customization.race,
                    customization.material,
                    customization.head
                );
                if (!character) {
                    return res.status(500).send({ message: "Create Failed" });
                }

                return res.send({
                    message: "Create Successful",
                    character,
                });
            } catch (error) {
                if (error instanceof CharacterLimitError) {
                    return res.status(409).send({ message: "Character Limit Reached" });
                }
                Logger.error("[api][/create_character] request failed.", error);
                return res.status(500).send({ message: "Create Failed" });
            }
        });

        app.get("/get_character", async (req, res) => {
            const authorization = String(req.get("authorization") ?? "");
            const bearerMatch = authorization.match(/^Bearer\s+(.+)$/i);
            const token = String(bearerMatch?.[1] ?? requestValue(req, "token") ?? "").trim();
            const rawCharacterId = requestValue(req, "character_id");
            const characterId =
                typeof rawCharacterId === "number"
                    ? rawCharacterId
                    : typeof rawCharacterId === "string" && /^\d+$/.test(rawCharacterId.trim())
                      ? Number(rawCharacterId)
                      : Number.NaN;

            if (!token || !Number.isSafeInteger(characterId) || characterId <= 0) {
                return res.status(400).send({ message: "Invalid Parameters" });
            }

            try {
                const user = await database.getUserByToken(token);
                if (!user) {
                    return res.status(401).send({ message: "Invalid Token" });
                }

                const character = await database.getCharacter(characterId);
                if (!character || Number(character.user_id) !== Number(user.id)) {
                    // Do not reveal whether a character owned by somebody else exists.
                    return res.status(404).send({ message: "Character Not Found" });
                }

                return res.send({
                    message: "Get Character Successful",
                    character,
                });
            } catch (error) {
                Logger.error("[api][/get_character] request failed.", error);
                return res.status(500).send({ message: "Get Character Failed" });
            }
        });

        app.get("/register", (req, res) => {
            return res.status(501).send({ message: "Use the login endpoint to create an account." });
        });

        app.post("/returnRandomUser", async (req, res) => {
            // Express only honors X-Forwarded-For according to its configured
            // trust-proxy policy. Do not parse that attacker-controlled header here.
            const clientIp = requestIp(req);
            if (!quickPlayRateLimiter.allow(clientIp)) {
                res.setHeader("Retry-After", Math.ceil(QUICK_PLAY_RATE_LIMIT_WINDOW_MS / 1000));
                return res.status(429).send({ message: "Too Many Quick Play Requests" });
            }

            try {
                const username = await findAvailableRandomUsername((candidate) => database.doesUserNameExists(candidate));
                if (!username) {
                    return res.status(503).send({ message: "Could Not Allocate Guest Name" });
                }

                const password = nanoid();
                const user = await database.saveUser(username, password);
                const race = GameData.get("race", "humanoid");
                if (!user || !race || !Array.isArray(race.materials) || race.materials.length === 0) {
                    return res.status(500).send({ message: "Quick Play Failed" });
                }

                const materialIndex = Math.floor(Math.random() * race.materials.length);
                const character = await database.createCharacter(
                    user.token,
                    generateRandomPlayerName(),
                    race.key,
                    materialIndex,
                    "Head_Paladin"
                );
                if (!character) {
                    return res.status(500).send({ message: "Quick Play Failed" });
                }

                character.user_id = user.id;
                character.username = user.username;
                character.token = user.token;
                Logger.info("[api][/returnRandomUser] guest character created.");
                return res.send({
                    message: "Successful",
                    user: character,
                });
            } catch (error) {
                Logger.error("[api][/returnRandomUser] request failed.", error);
                return res.status(500).send({ message: "Quick Play Failed" });
            }
        });

        app.get("/getHelpPage", function (req, res) {
            const page = String(req.query.page ?? "");
            if (!/^[a-z0-9_-]+$/i.test(page)) {
                return res.status(400).send({ message: "Invalid Help Page" });
            }

            const src = path.resolve(__dirname, "../shared/Help");
            res.sendFile(path.join(src, page + ".html"));
        });

        app.get("/load_game_data", (req, res) => {
            return res.send({
                message: "Loaded successfully.",
                data: {
                    items: GameData.load("items"),
                    abilities: GameData.load("abilities"),
                    locations: GameData.load("locations"),
                    races: GameData.load("races"),
                    quests: GameData.load("quests"),
                    help: GameData.load("help"),
                },
            });
        });
    }
}

export { Api };
