// Colyseus + Express
import { createServer } from "http";
import express from "express";
import cors from "cors";
import compression from "compression";

import { Server, matchMaker } from "@colyseus/core";

import { WebSocketTransport } from "@colyseus/ws-transport";
import { GameRoom } from "./rooms/GameRoom";
import { ChatRoom } from "./rooms/ChatRoom";

import { Api } from "./Api";
import { Database } from "./Database";

import Logger from "./utils/Logger";
import { Config } from "../shared/Config";
import { createCorsOptions, createWebSocketOriginGuard, MAX_WEBSOCKET_PAYLOAD_BYTES } from "./HttpSecurity";

import "dotenv/config";

//////////////////////////////////////////////////
//////////////////////////////////////////////////
//////////////////////////////////////////////////

class GameServer {
    public api;
    public database: Database;
    public config: Config;

    constructor() {
        this.config = new Config();
        this.init();
    }

    async init() {
        // start db
        this.database = new Database(this.config);
        await this.database.init();
        await this.database.create();
        await this.database.resetOnlineStatuses();

        //////////////////////////////////////////////////
        ///////////// COLYSEUS GAME SERVER ///////////////
        //////////////////////////////////////////////////
        const port = this.config.port;
        const app = express();
        app.disable("x-powered-by");
        // Resolve X-Forwarded-For from the local/container reverse proxy only.
        // Express walks the chain right-to-left, so client-supplied prefixes do
        // not become req.ip. Public direct connections remain untrusted.
        app.set("trust proxy", process.env.TRUST_PROXY || "loopback, linklocal, uniquelocal");
        app.use(compression());
        app.use(express.json({ limit: "32kb" }));
        app.use(cors(createCorsOptions()));

        // create colyseus server
        const gameServer = new Server({
            transport: new WebSocketTransport({
                server: createServer(app),
                beforeUpgrade: createWebSocketOriginGuard(),
                maxPayload: MAX_WEBSOCKET_PAYLOAD_BYTES,
            }),
        });

        // define all rooms
        gameServer.define("game_room", GameRoom).filterBy(["location"]);
        gameServer.define("chat_room", ChatRoom).on("create", (room: ChatRoom) => {
            room.setDatabase(this.database);
        });

        // on localhost, simulate bad latency
        if (process.env.NODE_ENV !== "production") {
            Logger.info("[gameserver] Simulating 200ms of latency.");
            gameServer.simulateLatency(250);
        }

        // listen
        gameServer.listen(port).then(() => {
            // server is now running
            Logger.info("[gameserver] listening on http://localhost:" + port);

            // create town room
            //matchMaker.createRoom("game_room", { location: "lh_town" });

            // create island room
            //matchMaker.createRoom("game_room", { location: "lh_dungeon_01" });
        });

        // start dev routes
        if (process.env.NODE_ENV !== "production") {
            const { monitor } = await import("@colyseus/monitor");

            // start monitor
            app.use("/colyseus", monitor());

            // bind it as an express middleware
            //app.use("/playground", playground);
        }

        //////////////////////////////////////////////////
        //// SERVING CLIENT DIST FOLDER TO EXPRESS ///////
        /////////////////////////////////////////////////

        this.api = new Api(app, this.database);
    }
}

new GameServer();
