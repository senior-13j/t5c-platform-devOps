#!/usr/bin/env node

const { Client } = require("colyseus.js");

const endpoint = process.env.SMOKE_WS_URL || "wss://arkadii.game.local";
const roomName = process.env.SMOKE_ROOM || "chat_room";
const timeoutMs = Number(process.env.SMOKE_TIMEOUT_MS || 10000);

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
            sessionId: "smoke-test",
            name: "smoke-test",
        }),
        `joining ${roomName} at ${endpoint}`
    );

    console.log(`WebSocket smoke test passed: ${endpoint} -> ${room.name} (${room.sessionId})`);

    await Promise.resolve(room.leave());
})().catch((error) => {
    console.error("WebSocket smoke test failed:", error);
    process.exit(1);
});
