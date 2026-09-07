import { Client } from "@colyseus/sdk";
import { cli } from "@colyseus/loadtest";
import type { Options } from "@colyseus/loadtest";

cli(async (options: Options) => {
    const client = new Client(options.endpoint);
    const roomName = options.roomName || "chat_room";
    const token = String(process.env.LOADTEST_TOKEN || "").trim();
    const characterId = Number(process.env.LOADTEST_CHARACTER_ID);

    if (!token || !Number.isSafeInteger(characterId) || characterId <= 0) {
        throw new Error("LOADTEST_TOKEN and a positive LOADTEST_CHARACTER_ID are required.");
    }
    if (roomName !== "chat_room") {
        throw new Error("This load-test scenario only supports chat_room; game_room requires one character per concurrent client.");
    }

    await client.joinOrCreate(roomName, { token, character_id: characterId });
});
