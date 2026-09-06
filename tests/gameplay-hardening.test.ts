import assert from "node:assert/strict";
import { test } from "node:test";
import { CalculationTypes, EntityState, QuestObjective, type Ability, type Quest } from "../src/shared/types";
import {
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
    canClaimWorldEntity,
    canProcessDefeat,
    canProcessDebugMessages,
    clampHealth,
    getLocationSpawnPoint,
    getMaximumAbilityCost,
    getKnownRoomLocation,
    getSingleTargetAbilityRange,
    hasSufficientAbilityResource,
    isAbilityCooldownReady,
    isEquippedItemRequestValid,
    isItemQuantityCompatibleWithStacking,
    isQuestProgressComplete,
    isSquaredDistanceWithinRange,
    isVendorWithinRange,
    parsePositiveQuantity,
} from "../src/server/rooms/gameplayRules";
import { LocationsDB } from "../src/server/data/LocationsDB";

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
