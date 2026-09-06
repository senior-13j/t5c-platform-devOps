import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";

import { Callbacks, Client as BrowserClient } from "@colyseus/sdk";
import { Client, Room, Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { schema, StateView, t } from "@colyseus/schema";

test("decorated hotbar schema keeps entry type separate from combat metadata", () => {
    const output = execFileSync(
        process.execPath,
        [
            "-r",
            "ts-node/register/transpile-only",
            "-e",
            [
                'const { HotbarSchema } = require("./src/server/rooms/schema/player/HotbarSchema");',
                'const entry = new HotbarSchema({ digit: 3, type: "ability", key: "fire_dart" });',
                "process.stdout.write(JSON.stringify({ digit: entry.digit, type: entry.type, key: entry.key }));",
            ].join(""),
        ],
        { cwd: process.cwd(), encoding: "utf8" }
    );

    assert.deepEqual(JSON.parse(output), { digit: 3, type: "ability", key: "fire_dart" });
});

test("legacy gameplay controllers reject hostile targets without throwing or repathing forever", () => {
    const output = execFileSync(
        process.execPath,
        [
            "-r",
            "ts-node/register/transpile-only",
            "-e",
            [
                'const { Vector3 } = require("./src/shared/Libs/yuka-min");',
                'const { abilitiesCTRL } = require("./src/server/rooms/controllers/abilityCTRL");',
                'const { dynamicCTRL } = require("./src/server/rooms/controllers/dynamicCTRL");',
                'const { gameDataCTRL } = require("./src/server/rooms/controllers/gameDataCTRL");',
                'const { moveCTRL } = require("./src/server/rooms/controllers/moveCTRL");',
                'const { GameRoomState } = require("./src/server/rooms/state/GameRoomState");',
                'const { BrainSchema } = require("./src/server/rooms/schema/BrainSchema");',
                'const { ServerMsg } = require("./src/shared/types");',
                'const entities = new Map();',
                'const owner = { sessionId: "player-1", type: "player", mana: 100, isEntityDead: () => false, animationCTRL: { isAnimating: false }, _state: { entities } };',
                'entities.set(owner.sessionId, owner);',
                'const abilities = Object.create(abilitiesCTRL.prototype);',
                'abilities._owner = owner; abilities.gdc_in_cooldown = false; abilities.ability_in_cooldown = [false, false];',
                'const loot = { sessionId: "loot-1", type: "item", getPosition: () => new Vector3() };',
                'const combat = abilities.canEntityCastAbility(owner, loot, { needTarget: true, castSelf: false }, 1);',
                'const roomData = new gameDataCTRL();',
                'const dynamic = new dynamicCTRL({ _state: { gameData: roomData }, player_data: { quests: new Map() } });',
                'const quest = dynamic.questUpdate({ key: "toString", status: 1 });',
                'let pathChecks = 0;',
                'const combatTarget = Object.create(BrainSchema.prototype); Object.defineProperties(combatTarget, { sessionId: { value: "npc-1", writable: true }, getPosition: { value: () => new Vector3(10, 0, 10) } });',
                'const moveOwner = { AI_TARGET: combatTarget, AI_TARGET_POSITION: null, AI_TARGET_WAYPOINTS: [], AI_TARGET_DISTANCE: 100, AI_TARGET_FOUND: false, AI_ABILITY: {}, speed: 0.1, hasTarget() { return this.AI_TARGET; }, monitorTarget() { this.AI_TARGET_POSITION = this.AI_TARGET.getPosition(); }, getPosition: () => new Vector3(), _state: { entities: new Map([[combatTarget.sessionId, combatTarget]]) }, _navMesh: { checkPath() { pathChecks += 1; return false; } } };',
                'const movement = new moveCTRL(moveOwner); movement.update(); movement.update();',
                'let pickupTargetCalls = 0;',
                'const pickupPlayer = { isDead: false, setTarget() { pickupTargetCalls += 1; } };',
                'const otherPlayer = { sessionId: "player-2", type: "player" };',
                'const roomState = Object.create(GameRoomState.prototype);',
                'roomState.entityCTRL = { get: (id) => id === "player-1" ? pickupPlayer : otherPlayer };',
                'const pickup = roomState.processMessage({ sessionId: "player-1" }, ServerMsg.PLAYER_PICKUP, { sessionId: "player-2" });',
                'process.stdout.write("AQ_REGRESSION:" + JSON.stringify({ combat, quest, pathChecks, targetCleared: moveOwner.AI_TARGET === null, pickup, pickupTargetCalls }));',
            ].join(""),
        ],
        { cwd: process.cwd(), encoding: "utf8" }
    );

    const marker = "AQ_REGRESSION:";
    const markerIndex = output.lastIndexOf(marker);
    assert.notEqual(markerIndex, -1);
    assert.deepEqual(JSON.parse(output.slice(markerIndex + marker.length)), {
        combat: false,
        quest: false,
        pathChecks: 1,
        targetCleared: true,
        pickup: false,
        pickupTargetCalls: 0,
    });
});

test("manual and click movement share one normalized simulation-step allowance", () => {
    const output = execFileSync(
        process.execPath,
        [
            "-r",
            "ts-node/register/transpile-only",
            "-e",
            [
                'const { Vector3 } = require("./src/shared/Libs/yuka-min");',
                'const { moveCTRL } = require("./src/server/rooms/controllers/moveCTRL");',
                'const { LootSchema } = require("./src/server/rooms/schema/LootSchema");',
                'const owner = { x: 0, y: 0, z: 0, rot: 0, speed: 0.6, sequence: 0, blocked: false, isDead: false, AI_TARGET: { sessionId: "old-target" }, AI_TARGET_POSITION: null, AI_TARGET_DISTANCE: null, AI_TARGET_WAYPOINTS: [], AI_ABILITY: {}, AI_TARGET_FOUND: false, hasTarget() { return this.AI_TARGET ?? false; }, monitorTarget() {}, getPosition() { return new Vector3(this.x, this.y, this.z); }, _state: { entities: new Map() }, _navMesh: { clampMovementV2(_source, destination) { return destination; }, getRegionForPoint() { return null; }, checkPath() { return true; }, findPath() { return []; } } };',
                'const movement = new moveCTRL(owner); const destination = new Vector3(10, 0, 10);',
                'const initialClick = movement.setClickToMoveDestination(destination); const clickClearedTarget = owner.AI_TARGET === null && owner.AI_ABILITY === null;',
                'const manual = movement.processPlayerInput({ seq: 1, h: -1, v: 0 }); const manualClearedPath = owner.AI_TARGET_WAYPOINTS.length === 0;',
                'const resumedClick = movement.setClickToMoveDestination(destination); movement.update(); const afterCombined = { x: owner.x, z: owner.z };',
                'movement.update(); const autoStep = Math.hypot(owner.x - afterCombined.x, owner.z - afterCombined.z);',
                'const diagonal = movement.moveTo(new Vector3(0, 0, 0), destination, owner.speed); const diagonalStep = Math.hypot(diagonal.x, diagonal.z);',
                'const secondManual = movement.processPlayerInput({ seq: 2, h: -1, v: 0 }); const secondManualClearedPath = owner.AI_TARGET_WAYPOINTS.length === 0;',
                'let pickupAttempts = 0; const loot = Object.create(LootSchema.prototype); Object.defineProperty(loot, "sessionId", { value: "full-inventory-loot" }); owner._state.entities.set(loot.sessionId, loot); owner.AI_TARGET = loot; owner.AI_TARGET_POSITION = destination; owner.AI_TARGET_DISTANCE = 0.5; owner.pickupItem = () => { pickupAttempts += 1; return false; }; movement.update(); movement.update(); const failedPickupCleared = owner.AI_TARGET === null && owner.AI_TARGET_WAYPOINTS.length === 0;',
                'process.stdout.write(JSON.stringify({ initialClick, clickClearedTarget, manual, manualClearedPath, resumedClick, afterCombined, autoStep, diagonalStep, secondManual, secondManualClearedPath, pickupAttempts, failedPickupCleared }));',
            ].join(""),
        ],
        { cwd: process.cwd(), encoding: "utf8" }
    );

    const result = JSON.parse(output);
    assert.equal(result.initialClick, true);
    assert.equal(result.clickClearedTarget, true);
    assert.equal(result.manual, true);
    assert.equal(result.manualClearedPath, true);
    assert.equal(result.resumedClick, true);
    assert.ok(Math.abs(result.afterCombined.x - 0.6) < 1e-12);
    assert.ok(Math.abs(result.afterCombined.z) < 1e-12);
    assert.ok(Math.abs(result.autoStep - 0.6) < 1e-12);
    assert.ok(Math.abs(result.diagonalStep - 0.6) < 1e-12);
    assert.equal(result.secondManual, true);
    assert.equal(result.secondManualClearedPath, true);
    assert.equal(result.pickupAttempts, 1);
    assert.equal(result.failedPickupCleared, true);
});

test("legacy player actions enforce ability ownership, item requirements, and consumable cooldowns", () => {
    const output = execFileSync(
        process.execPath,
        [
            "-r",
            "ts-node/register/transpile-only",
            "-e",
            [
                'const { GameData } = require("./src/server/GameData");',
                'const { AbilitiesDB } = require("./src/server/data/AbilitiesDB");',
                'const { ItemsDB } = require("./src/server/data/ItemDB");',
                'const { abilitiesCTRL } = require("./src/server/rooms/controllers/abilityCTRL");',
                'const { dropCTRL } = require("./src/server/rooms/controllers/dropCTRL");',
                'const { PlayerSchema } = require("./src/server/rooms/schema/PlayerSchema");',
                'const inventory = new Map();',
                'const potion = { key: "potion_small_red", i: "0", qty: 2 }; inventory.set("0", potion);',
                'const player = Object.create(PlayerSchema.prototype);',
                'Object.defineProperties(player, { x: { value: 0, writable: true }, y: { value: 0, writable: true }, z: { value: 0, writable: true }, health: { value: 10, writable: true }, maxHealth: { value: 100, writable: true }, mana: { value: 10, writable: true }, maxMana: { value: 100, writable: true }, level: { value: 1, writable: true }, type: { value: "player", writable: true }, equipment: { value: new Map() }, player_data: { value: { inventory, hotbar: new Map(), abilities: new Map(), gold: 1000, strength: 20, endurance: 20, agility: 20, intelligence: 20, wisdom: 20 } }, _state: { value: { gameData: GameData, roomDetails: GameData.get("location", "lh_town"), config: { PLAYER_HOTBAR_SIZE: 9 } } }, itemCooldownUntil: { value: new Map() }, statsCTRL: { value: { equipItem() {} } } });',
                'const firstPotion = player.consumeItem(potion, 1000); const blockedPotion = player.consumeItem(potion, 1000); const secondPotion = player.consumeItem(potion, 2000);',
                'const amulet = { key: "amulet_01", i: "1", qty: 1 }; inventory.set("1", amulet);',
                'const lowLevelEquip = player.equipItem(amulet); player.level = 10; const validEquip = player.equipItem(amulet);',
                'player.player_data.hotbar.set("2", { digit: 2, type: "ability", key: "slice_attack" }); player.player_data.abilities.set("slice_attack", { key: "slice_attack" });',
                'const abilities = Object.create(abilitiesCTRL.prototype); abilities._owner = player; abilities.abilitiesDB = AbilitiesDB; abilities.ability_in_cooldown = Array(11).fill(false);',
                'const knownAbility = abilities.getByDigit(2)?.key; player.player_data.abilities.delete("slice_attack"); const unknownAbility = abilities.getByDigit(2);',
                'player.level = 2; player.player_data.intelligence = 21; player.player_data.wisdom = 21; const farTraining = abilities.learnAbility("fire_dart"); player.x = 59.43; player.y = 8.01; player.z = 40.29; const validTraining = abilities.learnAbility("fire_dart"); const duplicateTraining = abilities.learnAbility("fire_dart"); const wrongTrainer = abilities.learnAbility("light_heal");',
                'const rewardOwner = { level: 1, player_data: { experience: 0 }, statsCTRL: { updateBaseStats() {}, getStat() { return 100; } }, getClient() {} }; const rewards = new dropCTRL(rewardOwner); const rewardless = rewards.addExperience({ experienceGain: 0, AI_SPAWN_INFO: {} }); const malformedReward = rewards.addExperience({ AI_SPAWN_INFO: {} });',
                'process.stdout.write("AQ_AUTHORITY:" + JSON.stringify({ firstPotion, blockedPotion, secondPotion, health: player.health, potionOwned: inventory.has("0"), lowLevelEquip, validEquip, amuletOwned: inventory.has("1"), amuletEquipped: player.equipment.has("amulet_01"), knownAbility, unknownAbility: unknownAbility ?? null, canonicalAmulet: ItemsDB.amulet_01.key, farTraining, validTraining, duplicateTraining, wrongTrainer, trainedAbility: player.player_data.abilities.has("fire_dart"), trainingGold: player.player_data.gold, rewardless, malformedReward, rewardExperience: rewardOwner.player_data.experience, rewardLevel: rewardOwner.level }));',
            ].join(""),
        ],
        { cwd: process.cwd(), encoding: "utf8" }
    );

    const marker = "AQ_AUTHORITY:";
    const markerIndex = output.lastIndexOf(marker);
    assert.notEqual(markerIndex, -1);
    assert.deepEqual(JSON.parse(output.slice(markerIndex + marker.length)), {
        firstPotion: true,
        blockedPotion: false,
        secondPotion: true,
        health: 60,
        potionOwned: false,
        lowLevelEquip: false,
        validEquip: true,
        amuletOwned: false,
        amuletEquipped: true,
        knownAbility: "slice_attack",
        unknownAbility: null,
        canonicalAmulet: "amulet_01",
        farTraining: false,
        validTraining: true,
        duplicateTraining: false,
        wrongTrainer: false,
        trainedAbility: true,
        trainingGold: 468,
        rewardless: true,
        malformedReward: false,
        rewardExperience: 0,
        rewardLevel: 1,
    });
});

test("room ping responses are bounded and ground loot is capped and expired", () => {
    const output = execFileSync(
        process.execPath,
        [
            "-r",
            "ts-node/register/transpile-only",
            "-e",
            [
                'const { GROUND_LOOT_TTL_MS, MAX_GROUND_LOOT_PER_ROOM } = require("./src/server/rooms/gameplayRules");',
                'const { GameRoomState } = require("./src/server/rooms/state/GameRoomState");',
                'const { LootSchema } = require("./src/server/rooms/schema/LootSchema");',
                'const { ServerMsg } = require("./src/shared/types");',
                'const state = Object.create(GameRoomState.prototype); const entities = new Map();',
                'Object.defineProperty(state, "entities", { value: entities });',
                'state.entityCTRL = { all: entities, hasEntities: () => entities.size > 0, add: (entity) => entities.set(entity.sessionId, entity), delete: (entity) => entities.delete(entity.sessionId) }; state.spawnCTRL = { update() {} };',
                'const sent = []; const client = { send: (type, data) => sent.push({ type, data }) }; const validPing = state.processMessage(client, ServerMsg.PING, { date: 123, pad: "x".repeat(1000) }); const invalidPing = state.processMessage(client, ServerMsg.PING, { date: "123" });',
                'for (let index = 0; index < MAX_GROUND_LOOT_PER_ROOM; index += 1) { const loot = Object.create(LootSchema.prototype); Object.defineProperties(loot, { sessionId: { value: `loot-${index}` }, spawnTimer: { value: index === 0 ? GROUND_LOOT_TTL_MS : 0, writable: true } }); if (!state.addGroundLoot(loot)) throw new Error("cap filled too early"); }',
                'const overflow = Object.create(LootSchema.prototype); Object.defineProperty(overflow, "sessionId", { value: "overflow" }); const capRejected = state.addGroundLoot(overflow) === false; state.update(0);',
                'process.stdout.write("AQ_ROOM_LIMITS:" + JSON.stringify({ validPing, invalidPing, sent, capRejected, expiredRemoved: !entities.has("loot-0"), remaining: entities.size }));',
            ].join(""),
        ],
        { cwd: process.cwd(), encoding: "utf8" }
    );

    const marker = "AQ_ROOM_LIMITS:";
    const markerIndex = output.lastIndexOf(marker);
    assert.notEqual(markerIndex, -1);
    assert.deepEqual(JSON.parse(output.slice(markerIndex + marker.length)), {
        validPing: true,
        invalidPing: false,
        sent: [{ type: 2, data: { date: 123 } }],
        capRejected: true,
        expiredRemoved: true,
        remaining: 127,
    });
});

const MigrationPlayer = schema(
    {
        sessionId: t.string(),
        name: t.string(),
        privateNote: t.string().view(),
    },
    "MigrationPlayer"
);

const MigrationState = schema(
    {
        players: t.map(MigrationPlayer),
    },
    "MigrationState"
);

type MigrationStateInstance = InstanceType<typeof MigrationState>;

class MigrationRoom extends Room<{ state: MigrationStateInstance }> {
    onCreate(options: { location: string }) {
        this.autoDispose = true;
        this.setMetadata({ location: options.location });
        this.setState(new MigrationState());
    }

    onJoin(client: Client, options: { privateNote: string }) {
        const player = new MigrationPlayer();
        player.sessionId = client.sessionId;
        player.name = `player-${this.clients.length}`;
        player.privateNote = options.privateNote;
        this.state.players.set(client.sessionId, player);

        client.view = new StateView();
        client.view.add(player);
    }
}

async function waitFor(assertion: () => void, label: string): Promise<void> {
    const deadline = Date.now() + 5_000;
    let lastError: unknown;
    while (Date.now() < deadline) {
        try {
            assertion();
            return;
        } catch (error) {
            lastError = error;
            await new Promise((resolve) => setTimeout(resolve, 20));
        }
    }
    throw new Error(`${label} timed out`, { cause: lastError });
}

async function withTimeout<T>(promise: Promise<T>, label: string): Promise<T> {
    let timer: NodeJS.Timeout;
    const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(`${label} timed out`)), 5_000);
    });
    try {
        return await Promise.race([promise, timeout]);
    } finally {
        clearTimeout(timer!);
    }
}

test("Colyseus 0.18 matches by location, emits proxy callbacks, and keeps view fields private", async (t) => {
    const httpServer = createServer();
    const transport = new WebSocketTransport({ server: httpServer, pingInterval: 0 });
    const server = new Server({ transport, greet: false, gracefullyShutdown: false });
    const roomName = `migration_${process.pid}`;
    const rooms: Array<{ leave: () => Promise<number> }> = [];
    server.define(roomName, MigrationRoom).filterBy(["location"]);

    await withTimeout(server.listen(0, "127.0.0.1"), "server listen");
    t.after(async () => {
        await Promise.allSettled(rooms.map((room) => withTimeout(room.leave().then(() => undefined), "room leave")));
        try {
            await withTimeout(server.gracefullyShutdown(false), "graceful shutdown");
        } catch {
            transport.shutdown();
        }
        if (httpServer.listening) {
            httpServer.closeAllConnections();
            await withTimeout(new Promise<void>((resolve) => httpServer.close(() => resolve())), "server close");
        }
    });

    const port = (httpServer.address() as AddressInfo).port;
    const endpoint = `ws://127.0.0.1:${port}`;
    const first = await withTimeout(
        new BrowserClient(endpoint).joinOrCreate(roomName, {
            location: "arkadia",
            privateNote: "first-secret",
        }),
        "first room join"
    );
    rooms.push(first);

    const additions: string[] = [];
    const callbacks = Callbacks.get(first);
    callbacks.onAdd("players", (player) => additions.push(player.sessionId));

    const second = await withTimeout(
        new BrowserClient(endpoint).joinOrCreate(roomName, {
            location: "arkadia",
            privateNote: "second-secret",
        }),
        "second room join"
    );
    rooms.push(second);

    const otherLocation = await withTimeout(
        new BrowserClient(endpoint).joinOrCreate(roomName, {
            location: "arkadia-dungeon",
            privateNote: "third-secret",
        }),
        "other-location room join"
    );
    rooms.push(otherLocation);

    assert.equal(first.roomId, second.roomId);
    assert.notEqual(first.roomId, otherLocation.roomId);

    await waitFor(() => {
        assert.equal(first.state.players.size, 2);
        assert.deepEqual(new Set(additions), new Set([first.sessionId, second.sessionId]));
    }, "state callback synchronization");

    const ownPlayer = first.state.players.get(first.sessionId);
    const remotePlayer = first.state.players.get(second.sessionId);
    assert.equal(ownPlayer?.privateNote, "first-secret");
    assert.equal(remotePlayer?.privateNote, undefined);
});
