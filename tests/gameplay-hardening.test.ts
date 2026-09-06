import assert from "node:assert/strict";
import { test } from "node:test";
import { CalculationTypes, EntityState, QuestObjective, type Ability, type Quest } from "../src/shared/types";
import { Leveling, MAX_EXPERIENCE } from "../src/shared/Class/Leveling";
import {
    GROUND_LOOT_TTL_MS,
    MAX_GROUND_LOOT_PER_ROOM,
    MAX_INVENTORY_QUANTITY,
    MAX_GOLD_BALANCE,
    MAX_HEALTH_VALUE,
    MAX_SINGLE_TARGET_ABILITY_RANGE,
    MAX_TRADE_QUANTITY,
    calculateSaturatedGoldBalance,
    calculateIncreasedBalance,
    calculateDroppedQuantity,
    calculatePurchaseCost,
    calculateRemainingQuantity,
    canAddGroundLoot,
    canClaimWorldEntity,
    canProcessDefeat,
    canProcessDebugMessages,
    clampHealth,
    canUseKnownAbility,
    getRewardRange,
    getLocationSpawnPoint,
    getMaximumAbilityCost,
    getKnownRoomLocation,
    getSingleTargetAbilityRange,
    hasSufficientAbilityResource,
    isAbilityCooldownReady,
    isCombatAbilityTarget,
    isEquippedItemRequestValid,
    isItemQuantityCompatibleWithStacking,
    isConsumableCooldownReady,
    isGroundLootExpired,
    isQuestDefinition,
    isQuestProgressComplete,
    isSquaredDistanceWithinRange,
    isTrainerWithinRange,
    isVendorWithinRange,
    meetsAbilityRequirements,
    meetsItemRequirements,
    parsePositiveQuantity,
} from "../src/server/rooms/gameplayRules";
import { LocationsDB } from "../src/server/data/LocationsDB";
import { GameData } from "../src/server/GameData";
import { gameDataCTRL } from "../src/server/rooms/controllers/gameDataCTRL";
import { ItemsDB } from "../src/server/data/ItemDB";

function ability(overrides: Partial<Ability> = {}): Ability {
    return {
        key: "test_ability",
        icon: "",
        sound: "",
        soundDelay: 0,
        title: "Test ability",
        description: "",
        castSelf: true,
        needTarget: false,
        castTime: 0,
        cooldown: 0,
        repeat: 0,
        repeatInterval: 0,
        range: 0,
        minRange: 0,
        animation: EntityState.IDLE,
        effect: {},
        casterPropertyAffected: [],
        targetPropertyAffected: [],
        ...overrides,
    };
}

test("quantity validation rejects malformed and excessive transaction values", () => {
    assert.equal(parsePositiveQuantity(1), 1);
    assert.equal(parsePositiveQuantity(MAX_INVENTORY_QUANTITY), MAX_INVENTORY_QUANTITY);
    assert.equal(parsePositiveQuantity(0), null);
    assert.equal(parsePositiveQuantity(-1), null);
    assert.equal(parsePositiveQuantity(1.5), null);
    assert.equal(parsePositiveQuantity("1"), null);
    assert.equal(parsePositiveQuantity(MAX_TRADE_QUANTITY + 1, MAX_TRADE_QUANTITY), null);
});

test("game rooms accept only known location keys and cannot expose arbitrary path input", () => {
    assert.equal(getKnownRoomLocation("lh_town", LocationsDB), "lh_town");
    assert.equal(getKnownRoomLocation("training_ground", LocationsDB), "training_ground");
    assert.equal(getKnownRoomLocation("../../database", LocationsDB), null);
    assert.equal(getKnownRoomLocation("missing_zone", LocationsDB), null);
    assert.equal(getKnownRoomLocation("toString", LocationsDB), null);
});

test("inventory reductions honor the requested amount and reject underflow", () => {
    assert.equal(calculateRemainingQuantity(5, 3), 2);
    assert.equal(calculateRemainingQuantity(5, 5), 0);
    assert.equal(calculateRemainingQuantity(5, 6), null);
    assert.equal(calculateRemainingQuantity(5, -1), null);
});

test("drop quantity is one for a single drop and the full stack for drop-all", () => {
    assert.equal(calculateDroppedQuantity(5, false), 1);
    assert.equal(calculateDroppedQuantity(5, true), 5);
    assert.equal(calculateDroppedQuantity(0, false), null);
});

test("purchase cost requires a positive bounded quantity and sufficient gold", () => {
    assert.equal(calculatePurchaseCost(100, 2, 500), 200);
    assert.equal(calculatePurchaseCost(100, -2, 500), null);
    assert.equal(calculatePurchaseCost(100, 6, 500), null);
    assert.equal(calculatePurchaseCost(-100, 1, 500), null);
    assert.equal(calculatePurchaseCost(100, MAX_TRADE_QUANTITY + 1, 100_000), null);
    assert.equal(calculatePurchaseCost(100, 1, MAX_GOLD_BALANCE + 1), null);
});

test("gold balance increases cannot overflow the networked uint32 value", () => {
    assert.equal(calculateIncreasedBalance(100, 25), 125);
    assert.equal(calculateIncreasedBalance(MAX_GOLD_BALANCE, 0), MAX_GOLD_BALANCE);
    assert.equal(calculateIncreasedBalance(MAX_GOLD_BALANCE, 1), null);
    assert.equal(calculateIncreasedBalance(-1, 1), null);
});

test("gold rewards saturate at uint32 max and reject malformed grants", () => {
    assert.equal(calculateSaturatedGoldBalance(100, 25), 125);
    assert.equal(calculateSaturatedGoldBalance(MAX_GOLD_BALANCE - 5, 10), MAX_GOLD_BALANCE);
    assert.equal(calculateSaturatedGoldBalance(MAX_GOLD_BALANCE, 1), MAX_GOLD_BALANCE);
    assert.equal(calculateSaturatedGoldBalance(100, -1), null);
    assert.equal(calculateSaturatedGoldBalance(Number.NaN, 10), null);
});

test("non-stackable items cannot be represented or purchased as multi-item stacks", () => {
    assert.equal(isItemQuantityCompatibleWithStacking(true, 10), true);
    assert.equal(isItemQuantityCompatibleWithStacking(false, 1), true);
    assert.equal(isItemQuantityCompatibleWithStacking(false, 2), false);
    assert.equal(isItemQuantityCompatibleWithStacking(undefined, 2), false);
});

test("unequip requests must match a real equipped item and its canonical slot", () => {
    const equipped = { key: "sword_01", slot: 6 };
    const item = { key: "sword_01", equippable: { slot: 6 } };
    assert.equal(isEquippedItemRequestValid("sword_01", 6, equipped, item), true);
    assert.equal(isEquippedItemRequestValid("sword_01", undefined, equipped, item), true);
    assert.equal(isEquippedItemRequestValid("shield_01", 6, undefined, item), false);
    assert.equal(isEquippedItemRequestValid("sword_01", 7, equipped, item), false);
    assert.equal(isEquippedItemRequestValid("sword_01", 6, equipped, { ...item, equippable: { slot: 7 } }), false);

});

test("a removed world loot object cannot be claimed from a stale target reference", () => {
    const loot = { sessionId: "loot-1" };
    assert.equal(canClaimWorldEntity(undefined, undefined, loot), true);
    assert.equal(canClaimWorldEntity("loot-1", loot, loot), true);
    assert.equal(canClaimWorldEntity("loot-1", undefined, loot), false);
    assert.equal(canClaimWorldEntity("loot-1", { sessionId: "loot-1" }, loot), false);
});

test("vendor authorization requires both proximity and an offered item", () => {
    const spawns = [
        {
            points: [{ x: 3, y: 0, z: 0 }],
            interactable: {
                data: [{ vendor: { items: [{ key: "potion_small_red" }] } }],
            },
        },
    ];

    assert.equal(isVendorWithinRange({ x: 0, y: 0, z: 0 }, spawns, "potion_small_red"), true);
    assert.equal(isVendorWithinRange({ x: 0, y: 0, z: 0 }, spawns, "sword_01"), false);
    assert.equal(isVendorWithinRange({ x: 20, y: 0, z: 0 }, spawns, "potion_small_red"), false);
});

test("quest completion requires active keyed progress and cannot repeat after completion", () => {
    const quest = {
        key: "quest_1",
        type: QuestObjective.KILL_AMOUNT,
        quantity: 3,
        isRepeatable: false,
    } as Quest;

    assert.equal(isQuestProgressComplete(quest, { qty: 3, status: 0 }), true);
    assert.equal(isQuestProgressComplete(quest, { qty: 2, status: 0 }), false);
    assert.equal(isQuestProgressComplete(quest, { qty: 3, status: 1 }), false);
    assert.equal(isQuestProgressComplete(quest, undefined), false);
});

test("ability mana validation reserves the maximum possible randomized cost", () => {
    const spell = ability({
        casterPropertyAffected: [
            { key: "mana", type: CalculationTypes.REMOVE, min: 5, max: 10 },
            { key: "health", type: CalculationTypes.REMOVE, min: 1, max: 2 },
        ],
    });

    assert.equal(getMaximumAbilityCost(spell, "mana"), 10);
    assert.equal(getMaximumAbilityCost(spell, "health"), 2);
});

test("single-target abilities have a finite server range even when configured range is zero", () => {
    assert.equal(getSingleTargetAbilityRange(ability({ minRange: 3 })), 3);
    assert.equal(getSingleTargetAbilityRange(ability({ minRange: 0 })), MAX_SINGLE_TARGET_ABILITY_RANGE);
    assert.equal(getSingleTargetAbilityRange(ability({ minRange: 1_000 })), MAX_SINGLE_TARGET_ABILITY_RANGE);
});

test("ability healing is clamped to max health and the network int16 ceiling", () => {
    assert.equal(clampHealth(150, 100), 100);
    assert.equal(clampHealth(50_000, 50_000), MAX_HEALTH_VALUE);
    assert.equal(clampHealth(-10, 100), 0);
});

test("NPC ability validation enforces both mana and cooldown before casting", () => {
    const spell = ability({
        needTarget: true,
        castSelf: false,
        casterPropertyAffected: [{ key: "mana", type: CalculationTypes.REMOVE, min: 5, max: 10 }],
    });

    assert.equal(hasSufficientAbilityResource(spell, "mana", 9), false);
    assert.equal(hasSufficientAbilityResource(spell, "mana", 10), true);
    assert.equal(hasSufficientAbilityResource(spell, "mana", Number.NaN), false);
    assert.equal(isAbilityCooldownReady([false, false], 1), true);
    assert.equal(isAbilityCooldownReady([false, true], 1), false);
    assert.equal(isAbilityCooldownReady([false, false], 5), false);
});

test("hotbar casting requires ownership while trainer requirements gate learning", () => {
    const player = {
        level: 1,
        player_data: { strength: 20, endurance: 20, agility: 20, intelligence: 20, wisdom: 20 },
    };
    const known = new Map([["slice_attack", { key: "slice_attack" }], ["fire_dart", { key: "fire_dart" }]]);
    const slice = ability({ key: "slice_attack" });
    const fire = ability({ key: "fire_dart", required_level: 2, required_intelligence: 21 });

    assert.equal(canUseKnownAbility({ type: "ability", key: "slice_attack" }, known, slice, player), true);
    assert.equal(canUseKnownAbility({ type: "item", key: "slice_attack" }, known, slice, player), false);
    assert.equal(canUseKnownAbility({ type: "ability", key: "poison" }, known, ability({ key: "poison" }), player), false);
    assert.equal(meetsAbilityRequirements(fire, player), false);
    assert.equal(canUseKnownAbility({ type: "ability", key: "fire_dart" }, known, fire, player), true);
    player.level = 2;
    player.player_data.intelligence = 21;
    assert.equal(canUseKnownAbility({ type: "ability", key: "fire_dart" }, known, fire, player), true);
    assert.equal(meetsAbilityRequirements({ key: "broken", required_level: Number.NaN }, player), false);
});

test("skill learning requires proximity to a trainer who offers that exact ability", () => {
    const sorceress = LocationsDB.lh_town.dynamic.spawns.find((spawn) => spawn.key === "lh_town_sorceress");
    assert.ok(sorceress);
    const position = sorceress.points[0];
    const spawns = LocationsDB.lh_town.dynamic.spawns;

    assert.equal(isTrainerWithinRange(position, spawns, "fire_dart"), true);
    assert.equal(isTrainerWithinRange(position, spawns, "light_heal"), false);
    assert.equal(isTrainerWithinRange({ x: 0, y: 0, z: 0 }, spawns, "fire_dart"), false);
    assert.equal(isTrainerWithinRange(position, spawns, "constructor"), false);
});

test("equipment requirements are resolved from a fixed stat allowlist", () => {
    const player = { level: 9, health: 100, mana: 100, player_data: { strength: 20 } };
    assert.equal(meetsItemRequirements(ItemsDB.amulet_01, player), false);
    player.level = 10;
    assert.equal(meetsItemRequirements(ItemsDB.amulet_01, player), true);
    assert.equal(meetsItemRequirements({ requirements: [{ key: "constructor", amount: 0 }] }, player), false);
    assert.equal(meetsItemRequirements({ requirements: [{ key: "level", amount: Number.NaN }] }, player), false);
});

test("consumable cooldowns cannot be bypassed by repeated messages", () => {
    assert.equal(isConsumableCooldownReady(undefined, 1_000), true);
    assert.equal(isConsumableCooldownReady(2_000, 1_999), false);
    assert.equal(isConsumableCooldownReady(2_000, 2_000), true);
    assert.equal(isConsumableCooldownReady(Number.NaN, 2_000), false);
});

test("ground loot expires after five minutes and rooms enforce a hard cap", () => {
    assert.equal(isGroundLootExpired(GROUND_LOOT_TTL_MS - 1), false);
    assert.equal(isGroundLootExpired(GROUND_LOOT_TTL_MS), true);
    assert.equal(isGroundLootExpired(Number.NaN), false);
    assert.equal(canAddGroundLoot(MAX_GROUND_LOOT_PER_ROOM - 1), true);
    assert.equal(canAddGroundLoot(MAX_GROUND_LOOT_PER_ROOM), false);
    assert.equal(canAddGroundLoot(-1), false);
});

test("rewardless enemies and malformed rewards cannot corrupt player experience", () => {
    const owner: any = {
        level: 1,
        player_data: { experience: 0 },
        statsCTRL: { updateBaseStats: () => undefined, getStat: () => 100 },
        getClient: () => undefined,
    };

    assert.deepEqual(getRewardRange(0), { min: 0, max: 0 });
    assert.equal(getRewardRange(undefined), null);
    assert.equal(getRewardRange({ min: 10, max: 5 }), null);
    assert.equal(Leveling.addExperience(owner, Number.NaN), false);
    assert.equal(owner.player_data.experience, 0);

    owner.level = 20;
    owner.player_data.experience = MAX_EXPERIENCE;
    assert.equal(Leveling.addExperience(owner, 1), true);
    assert.equal(owner.player_data.experience, MAX_EXPERIENCE);
    assert.equal(owner.level, 20);
    assert.equal(Leveling.convertXpToLevel(Number.NaN), 1);
    assert.equal(Leveling.getLevelProgress(MAX_EXPERIENCE), 100);
});

test("stuck reset uses the current location spawn without healing a living player", () => {
    const spawnPoint = getLocationSpawnPoint(LocationsDB.training_ground);
    assert.deepEqual(spawnPoint, { x: 0, y: 0, z: 0, rot: -180 });
    assert.equal(getLocationSpawnPoint({ spawnPoint: { x: 0, y: Number.NaN, z: 0, rot: 0 } }), null);

});

test("area targeting compares squared distance with squared linear range", () => {
    assert.equal(isSquaredDistanceWithinRange(36, 6), true);
    assert.equal(isSquaredDistanceWithinRange(36.01, 6), false);
    assert.equal(isSquaredDistanceWithinRange(5, 0), false);
    assert.equal(isSquaredDistanceWithinRange(Number.NaN, 6), false);
});

test("debug messages are denied unless the server explicitly runs in development or test", () => {
    assert.equal(canProcessDebugMessages("production"), false);
    assert.equal(canProcessDebugMessages(undefined), false);
    assert.equal(canProcessDebugMessages("development"), true);
    assert.equal(canProcessDebugMessages("test"), true);
});

test("death rewards only process for a newly defeated target and a living attacker", () => {
    assert.equal(canProcessDefeat(false, false, 0), true);
    assert.equal(canProcessDefeat(false, false, -10), true);
    assert.equal(canProcessDefeat(true, false, 0), false);
    assert.equal(canProcessDefeat(false, true, 0), false);
    assert.equal(canProcessDefeat(false, false, 1), false);
    assert.equal(canProcessDefeat(false, false, Number.NaN), false);
});

test("combat abilities reject loot and malformed targets without throwing", () => {
    const player = {
        sessionId: "player-1",
        type: "player" as const,
        getPosition: () => ({ x: 0, y: 0, z: 0 }),
        isEntityDead: () => false,
    };
    const loot = {
        sessionId: "loot-1",
        type: "item",
        getPosition: () => ({ x: 0, y: 0, z: 0 }),
    };

    assert.equal(isCombatAbilityTarget(player), true);
    assert.equal(isCombatAbilityTarget(loot), false);
    assert.equal(isCombatAbilityTarget({ type: "entity", sessionId: "npc" }), false);
});

test("game data and quest updates reject prototype keys without throwing", () => {
    const roomGameData = new gameDataCTRL();
    assert.equal(GameData.get("quest", "toString"), false);
    assert.equal(GameData.get("item", "constructor"), false);
    assert.equal(roomGameData.get("quest", "toString"), false);

    assert.equal(isQuestDefinition(Object.prototype.toString, "toString"), false);
    assert.equal(isQuestDefinition({ key: "quest", quantity: 1, isRepeatable: false }, "quest"), false);
});
