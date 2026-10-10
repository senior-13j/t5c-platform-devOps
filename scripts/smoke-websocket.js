#!/usr/bin/env node

const { Client } = require("@colyseus/sdk");

function optionValue(name) {
    const index = process.argv.indexOf(name);
    return index === -1 ? undefined : process.argv[index + 1];
}

const endpoint = optionValue("--endpoint") || process.env.SMOKE_WS_URL || "wss://arkadii.game.local";
const roomName = optionValue("--room") || process.env.SMOKE_ROOM || "chat_room";
const timeoutMs = Number(optionValue("--timeout-ms") || process.env.SMOKE_TIMEOUT_MS || 10000);
const token = String(optionValue("--token") || process.env.SMOKE_TOKEN || "").trim();
const characterId = Number(optionValue("--character-id") || process.env.SMOKE_CHARACTER_ID);

if (!token || !Number.isSafeInteger(characterId) || characterId <= 0) {
    console.error("Provide --token and a positive --character-id (or SMOKE_TOKEN and SMOKE_CHARACTER_ID).");
    process.exit(2);
}

function withTimeout(promise, label) {
    let timeout;
    const timeoutPromise = new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timeout));
}

(async () => {
    const client = new Client(endpoint);
    const room = await withTimeout(
        client.joinOrCreate(roomName, {
            token,
            character_id: characterId,
            ...(roomName === "game_room" ? { location: optionValue("--location") || process.env.SMOKE_LOCATION || "lh_town" } : {}),
        }),
        `joining ${roomName} at ${endpoint}`
    );

    console.log(`WebSocket smoke test passed: ${endpoint} -> ${room.name} (${room.sessionId})`);

    await Promise.resolve(room.leave());
})().catch((error) => {
    console.error("WebSocket smoke test failed:", error);
    process.exit(1);
});
