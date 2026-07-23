import { Client } from "colyseus.js";
import { cli } from "@colyseus/loadtest";
import type { Options } from "@colyseus/loadtest";

cli(async (options: Options) => {
    const client = new Client(options.endpoint);
    const roomName = options.roomName || "chat_room";

    await client.joinOrCreate(roomName, {
        sessionId: `loadtest-${options.clientId}`,
        name: `loadtest-${options.clientId}`,
    });
});
