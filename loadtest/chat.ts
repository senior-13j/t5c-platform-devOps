import { Client } from "@colyseus/sdk";
import { cli } from "@colyseus/loadtest";
import type { Options } from "@colyseus/loadtest";

function optionValue(name: string): string | undefined {
    const index = process.argv.indexOf(name);
    if (index === -1) {
        return undefined;
    }

    const value = process.argv[index + 1];
    process.argv.splice(index, value ? 2 : 1);
    return value;
}

const suppliedToken = optionValue("--token");
const suppliedCharacterId = optionValue("--character-id");

cli(async (options: Options) => {
    const client = new Client(options.endpoint);
    const roomName = options.roomName || "chat_room";
    const token = String(suppliedToken || process.env.LOADTEST_TOKEN || "").trim();
    const characterId = Number(suppliedCharacterId || process.env.LOADTEST_CHARACTER_ID);

    if (!token || !Number.isSafeInteger(characterId) || characterId <= 0) {
        throw new Error("Provide --token and a positive --character-id (or LOADTEST_TOKEN and LOADTEST_CHARACTER_ID).");
    }
    if (roomName !== "chat_room") {
        throw new Error("This load-test scenario only supports chat_room; game_room requires one character per concurrent client.");
    }

    await client.joinOrCreate(roomName, { token, character_id: characterId });
});
