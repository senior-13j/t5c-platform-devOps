import express from "express";
import path from "path";
import Logger from "./utils/Logger";
import { generateRandomPlayerName } from "../shared/Utils";
import { GameData } from "./GameData";
import { Database } from "./Database";
import { generateId } from "colyseus";

class Api {
    constructor(app, database: Database) {
        const requestValue = (req, key: string) => req.body?.[key] ?? req.query?.[key];
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
                        Logger.info("[api][/login] invalid credentials.");
                        return res.status(401).send({ message: "Invalid Credentials" });
                    }

                    Logger.info("[api][/login] user not found, creating new user.");
                    user = await database.saveUser(username, password);
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

        app.all("/loginWithToken", (req, res) => {
            const token = String(requestValue(req, "token") ?? "");
            if (token) {
                Logger.info("[api][/loginWithToken] checking token.");
                database
                    .getUserWithToken(token)
                    .then((user) => {
                        if (!user) {
                            Logger.info("[api][/login] invalid token.");
                            res.status(401).send({ message: "Invalid Token" });
                            return null;
                        }

                        Logger.info("[api][/login] valid token, refreshing login token.");
                        return database.refreshToken(user.id);
                    })
                    .then((user) => {
                        if (!user) {
                            return;
                        }
                        Logger.info("[api][/login] login succesful.");
                        return res.send({
                            message: "Login Successful",
                            user: safeUser(user),
                        });
                    });
            } else {
                return res.status(400).send({ message: "Missing Token" });
            }
        });

        app.post("/check", (req, res) => {
            const token = String(requestValue(req, "token") ?? "");
            if (token !== "") {
                database.checkToken(token).then((user) => {
                    if (!user) {
                        return res.status(400).send({
                            message: "Check Failed",
                        });
                    } else {
                        return res.send({
                            message: "Check Successful",
                            user: safeUser(user),
                        });
                    }
                });
            } else {
                return res.status(400).send({
                    message: "Check Failed",
                });
            }
        });

        app.post("/create_character", (req, res) => {
            const token = String(requestValue(req, "token") ?? "");
            const name = String(requestValue(req, "name") ?? "").trim().slice(0, 64);
            const race = String(requestValue(req, "race") ?? "");
            const material = Number(requestValue(req, "material") ?? 0);
            const head = requestValue(req, "head") ?? 0;
            if (token !== "") {
                database.createCharacter(token, name, race, material, head).then((character) => {
                    if (!character) {
                        return res.status(400).send({
                            message: "Create Failed",
                        });
                    } else {
                        return res.send({
                            message: "Create Successful",
                            character: character,
                        });
                    }
                });
            } else {
                return res.status(400).send({
                    message: "Create Failed",
                });
            }
        });

        app.get("/get_character", (req, res) => {
            const character_id: string = (req.query.character_id as string) ?? "";
            database.getCharacter(parseInt(character_id)).then((character) => {
                if (!character) {
                    return res.status(400).send({
                        message: "Get Character Failed",
                    });
                } else {
                    return res.send({
                        message: "Get Character Successful",
                        character: character,
                    });
                }
            });
        });

        app.get("/register", (req, res) => {
            return res.status(501).send({ message: "Use the login endpoint to create an account." });
        });

        app.post("/returnRandomUser", (req, res) => {
            let username;
            let password = generateId();
            const doSomething = async (username) =>
                new Promise((resolve) => {
                    database.doesUserNameExists(username).then((doesExists) => {
                        if (doesExists.count > 0) {
                            resolve("no");
                        } else {
                            resolve("ok");
                        }
                    });
                });

            const loop = async (value) => {
                let result = null;
                while (result != "ok") {
                    if (result > 20) {
                        result = "ok";
                    }
                    username = generateRandomPlayerName();
                    result = await doSomething(username);
                    value = value + 1;
                }
            };

            loop(1).then(() => {
                database.saveUser(username, password).then((user) => {
                    let race = GameData.get("race", "humanoid");
                    let material = race.materials[Math.floor(Math.random() * race.materials.length)];
                    let materialIndex = race.materials.indexOf(material);
                    database.createCharacter(user.token, generateRandomPlayerName(), race.key, materialIndex, "Head_Paladin").then((character) => {
                        character.user_id = user.id;
                        character.username = user.username;
                        character.token = user.token;
                        console.log("/returnRandomUser", character.name);
                        return res.send({
                            message: "Successful",
                            user: character,
                        });
                    });
                });
            });
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
