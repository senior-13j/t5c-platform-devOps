import { CalculationTypes, QuestObjective, type Ability, type Quest } from "../../shared/types";

export const MAX_INVENTORY_QUANTITY = 32767;
export const MAX_TRADE_QUANTITY = 100;
export const MAX_GOLD_BALANCE = 4_294_967_295;
export const MAX_EXPERIENCE_VALUE = 4_294_967_295;
export const MAX_HEALTH_VALUE = 32_767;
export const MAX_SINGLE_TARGET_ABILITY_RANGE = 24;
export const VENDOR_INTERACTION_DISTANCE = 5;
export const GROUND_LOOT_TTL_MS = 5 * 60 * 1000;
export const MAX_GROUND_LOOT_PER_ROOM = 128;
export const STARTER_ABILITY_KEYS = Object.freeze([
    "base_attack",
    "slice_attack",
]);

type Position = { x: number; y: number; z: number };
type SpawnPoint = Position & { rot: number };
type QuestProgress = { qty: number; status: number };

const ABILITY_REQUIREMENTS = [
    ["required_level", "level"],
    ["required_strength", "strength"],
    ["required_endurance", "endurance"],
    ["required_agility", "agility"],
    ["required_intelligence", "intelligence"],
    ["required_wisdom", "wisdom"],
] as const;

const ITEM_REQUIREMENT_STATS = new Map<string, string>([
    ["level", "level"],
    ["strength", "strength"],
    ["endurance", "endurance"],
    ["agility", "agility"],
    ["intelligence", "intelligence"],
    // Preserve compatibility with the historical PlayerKeys typo without
    // reading an attacker-selected property from the player object.
    ["inteligence", "intelligence"],
    ["wisdom", "wisdom"],
    ["ac", "ac"],
    ["health", "health"],
    ["mana", "mana"],
]);

function getPlayerStat(player: unknown, stat: string): number | null {
    const candidate = player as any;
    const value = stat === "level" || stat === "health" || stat === "mana"
        ? candidate?.[stat]
        : candidate?.player_data?.[stat];
    return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function collectionHasKey(collection: unknown, key: string): boolean {
    const candidate = collection as any;
    if (candidate && typeof candidate.has === "function") {
        return candidate.has(key) === true;
    }
    if (candidate && typeof candidate.get === "function") {
        return Boolean(candidate.get(key));
    }
    return Boolean(candidate && typeof candidate === "object" && Object.prototype.hasOwnProperty.call(candidate, key));
}

export function meetsAbilityRequirements(ability: unknown, player: unknown): boolean {
    const candidate = ability as Record<string, unknown> | null;
    if (!candidate || typeof candidate !== "object" || typeof candidate.key !== "string") {
        return false;
    }

    return ABILITY_REQUIREMENTS.every(([requirementKey, playerStat]) => {
        const requiredValue = candidate[requirementKey];
        if (requiredValue === undefined) {
            return true;
        }
        if (!Number.isSafeInteger(requiredValue) || Number(requiredValue) < 0) {
            return false;
        }
        const actualValue = getPlayerStat(player, playerStat);
        return actualValue !== null && actualValue >= Number(requiredValue);
    });
}

export function canUseKnownAbility(
    hotbarEntry: unknown,
    learnedAbilities: unknown,
    ability: unknown,
    player: unknown
): boolean {
    const entry = hotbarEntry as { type?: unknown; key?: unknown } | null;
    const candidate = ability as { key?: unknown } | null;
    return Boolean(
        entry &&
        entry.type === "ability" &&
        typeof entry.key === "string" &&
        candidate &&
        candidate.key === entry.key &&
        collectionHasKey(learnedAbilities, entry.key)
    );
}

export function meetsItemRequirements(item: unknown, player: unknown): boolean {
    const requirements = (item as { requirements?: unknown } | null)?.requirements;
    if (requirements === undefined) {
        return true;
    }
    if (!Array.isArray(requirements)) {
        return false;
    }

    return requirements.every((requirement) => {
        const key = typeof requirement?.key === "string" ? ITEM_REQUIREMENT_STATS.get(requirement.key) : undefined;
        const amount = requirement?.amount;
        if (!key || !Number.isSafeInteger(amount) || Number(amount) < 0) {
            return false;
        }
        const actualValue = getPlayerStat(player, key);
        return actualValue !== null && actualValue >= Number(amount);
    });
}

export function isConsumableCooldownReady(cooldownUntil: unknown, now: unknown = Date.now()): boolean {
    const timestamp = Number(now);
    if (!Number.isFinite(timestamp) || timestamp < 0) {
        return false;
    }
    return cooldownUntil === undefined ||
        (typeof cooldownUntil === "number" && Number.isFinite(cooldownUntil) && timestamp >= cooldownUntil);
}

export function getRewardRange(value: unknown): { min: number; max: number } | null {
    if (typeof value === "number") {
        return Number.isFinite(value) && value >= 0 ? { min: value, max: value } : null;
    }
    const candidate = value as { min?: unknown; max?: unknown } | null;
    const minimum = candidate?.min;
    const maximum = candidate?.max;
    if (
        typeof minimum !== "number" ||
        !Number.isFinite(minimum) ||
        minimum < 0 ||
        typeof maximum !== "number" ||
        !Number.isFinite(maximum) ||
        maximum < minimum
    ) {
        return null;
    }
    return { min: minimum, max: maximum };
}

export function isGroundLootExpired(ageMs: unknown, ttlMs: number = GROUND_LOOT_TTL_MS): boolean {
    return (
        typeof ageMs === "number" &&
        Number.isFinite(ageMs) &&
        ageMs >= 0 &&
        Number.isFinite(ttlMs) &&
        ttlMs >= 0 &&
        ageMs >= ttlMs
    );
}

export function canAddGroundLoot(currentCount: unknown, maximum: number = MAX_GROUND_LOOT_PER_ROOM): boolean {
    return (
        typeof currentCount === "number" &&
        Number.isSafeInteger(currentCount) &&
        currentCount >= 0 &&
        Number.isSafeInteger(maximum) &&
        maximum > 0 &&
        currentCount < maximum
    );
}

export function isCombatAbilityTarget(target: unknown): target is {
    sessionId: string;
    type: "entity" | "player";
    getPosition: () => any;
    isEntityDead: () => boolean;
} {
    const candidate = target as any;
    return Boolean(
        candidate &&
        (candidate.type === "entity" || candidate.type === "player") &&
        typeof candidate.sessionId === "string" &&
        candidate.sessionId.length > 0 &&
        typeof candidate.getPosition === "function" &&
        typeof candidate.isEntityDead === "function"
    );
}

export function isQuestDefinition(value: unknown, expectedKey: string): value is Quest {
    const quest = value as Partial<Quest> | null;
    const rewards = quest?.rewards as Partial<Quest["rewards"]> | null;
    return Boolean(
        quest &&
        typeof quest === "object" &&
        typeof quest.key === "string" &&
        quest.key === expectedKey &&
        Number.isSafeInteger(quest.quantity) &&
        Number(quest.quantity) >= 0 &&
        typeof quest.isRepeatable === "boolean" &&
        rewards &&
        typeof rewards === "object" &&
        Number.isSafeInteger(rewards.experience ?? 0) &&
        Number(rewards.experience ?? 0) >= 0 &&
        Number.isSafeInteger(rewards.gold ?? 0) &&
        Number(rewards.gold ?? 0) >= 0 &&
        Array.isArray(rewards.items ?? [])
    );
}

export function getKnownRoomLocation(value: unknown, locations: unknown): string | null {
    if (
        typeof value !== "string" ||
        value.length < 1 ||
        value.length > 64 ||
        !/^[a-z0-9_-]+$/i.test(value) ||
        !locations ||
        typeof locations !== "object" ||
        !Object.prototype.hasOwnProperty.call(locations, value)
    ) {
        return null;
    }

    return value;
}

export function parsePositiveQuantity(value: unknown, maximum = MAX_INVENTORY_QUANTITY): number | null {
    return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= maximum ? value : null;
}

export function calculateRemainingQuantity(current: unknown, amount: unknown): number | null {
    const currentQuantity = parsePositiveQuantity(current);
    const quantityToRemove = parsePositiveQuantity(amount);
    if (currentQuantity === null || quantityToRemove === null || quantityToRemove > currentQuantity) {
        return null;
    }
    return currentQuantity - quantityToRemove;
}

export function calculateDroppedQuantity(current: unknown, dropAll: boolean): number | null {
    const currentQuantity = parsePositiveQuantity(current);
    if (currentQuantity === null) {
        return null;
    }
    return dropAll ? currentQuantity : 1;
}

export function calculatePurchaseCost(unitPrice: unknown, quantity: unknown, availableGold: unknown): number | null {
    const parsedQuantity = parsePositiveQuantity(quantity, MAX_TRADE_QUANTITY);
    const parsedUnitPrice = Number(unitPrice);
    const parsedGold = Number(availableGold);
    if (
        parsedQuantity === null ||
        !Number.isSafeInteger(parsedUnitPrice) ||
        parsedUnitPrice < 0 ||
        !Number.isSafeInteger(parsedGold) ||
        parsedGold < 0 ||
        parsedGold > MAX_GOLD_BALANCE
    ) {
        return null;
    }

    const totalPrice = parsedUnitPrice * parsedQuantity;
    return Number.isSafeInteger(totalPrice) && totalPrice <= parsedGold ? totalPrice : null;
}

export function calculateIncreasedBalance(currentBalance: unknown, amount: unknown): number | null {
    const current = Number(currentBalance);
    const increase = Number(amount);
    if (
        !Number.isSafeInteger(current) ||
        current < 0 ||
        current > MAX_GOLD_BALANCE ||
        !Number.isSafeInteger(increase) ||
        increase < 0
    ) {
        return null;
    }

    const result = current + increase;
    return Number.isSafeInteger(result) && result <= MAX_GOLD_BALANCE ? result : null;
}

export function calculateSaturatedGoldBalance(currentBalance: unknown, amount: unknown): number | null {
    const current = Number(currentBalance);
    const increase = Number(amount);
    if (
        !Number.isSafeInteger(current) ||
        current < 0 ||
        current > MAX_GOLD_BALANCE ||
        !Number.isSafeInteger(increase) ||
        increase < 0
    ) {
        return null;
    }

    return increase >= MAX_GOLD_BALANCE - current ? MAX_GOLD_BALANCE : current + increase;
}

export function isItemQuantityCompatibleWithStacking(stackable: unknown, quantity: unknown): boolean {
    const parsedQuantity = parsePositiveQuantity(quantity);
    return parsedQuantity !== null && (stackable === true || parsedQuantity === 1);
}

export function isEquippedItemRequestValid(
    requestedKey: unknown,
    requestedSlot: unknown,
    equippedItem: unknown,
    itemDefinition: unknown
): boolean {
    const equipped = equippedItem as { key?: unknown; slot?: unknown };
    const item = itemDefinition as { key?: unknown; equippable?: { slot?: unknown } };
    if (
        typeof requestedKey !== "string" ||
        requestedKey.length === 0 ||
        !equipped ||
        !item ||
        equipped.key !== requestedKey ||
        item.key !== requestedKey ||
        typeof equipped.slot !== "number" ||
        !Number.isInteger(equipped.slot) ||
        equipped.slot !== item.equippable?.slot
    ) {
        return false;
    }

    return requestedSlot === undefined || requestedSlot === equipped.slot;
}

export function clampHealth(value: unknown, maximumHealth: unknown): number {
    const health = Number(value);
    const maximum = Number(maximumHealth);
    if (!Number.isFinite(health) || !Number.isFinite(maximum) || maximum <= 0) {
        return 0;
    }

    return Math.min(Math.max(health, 0), Math.min(maximum, MAX_HEALTH_VALUE));
}

export function getSingleTargetAbilityRange(ability: Pick<Ability, "minRange">): number {
    const configuredRange = Number(ability?.minRange);
    if (!Number.isFinite(configuredRange) || configuredRange <= 0) {
        return MAX_SINGLE_TARGET_ABILITY_RANGE;
    }

    return Math.min(configuredRange, MAX_SINGLE_TARGET_ABILITY_RANGE);
}

export function getLocationSpawnPoint(location: unknown): SpawnPoint | null {
    const spawnPoint = (location as { spawnPoint?: SpawnPoint })?.spawnPoint;
    if (!spawnPoint || ![spawnPoint.x, spawnPoint.y, spawnPoint.z, spawnPoint.rot].every(Number.isFinite)) {
        return null;
    }

    return {
        x: spawnPoint.x,
        y: spawnPoint.y,
        z: spawnPoint.z,
        rot: spawnPoint.rot,
    };
}

export function canClaimWorldEntity(sessionId: unknown, registeredEntity: unknown, requestedEntity: unknown): boolean {
    // Server-created rewards and purchases are transient and intentionally have
    // no session ID. A world entity must still be registered as the same object.
    return typeof sessionId !== "string" || sessionId.length === 0 || registeredEntity === requestedEntity;
}

export function isVendorWithinRange(
    playerPosition: Position,
    spawns: unknown,
    itemKey?: string,
    maximumDistance = VENDOR_INTERACTION_DISTANCE
): boolean {
    if (!isFinitePosition(playerPosition) || !Array.isArray(spawns) || !Number.isFinite(maximumDistance) || maximumDistance < 0) {
        return false;
    }
    const maximumDistanceSquared = maximumDistance * maximumDistance;

    return spawns.some((spawn: any) => {
        const dialogs = Array.isArray(spawn?.interactable?.data) ? spawn.interactable.data : [];
        const vendorOffersItem = dialogs.some((dialog: any) => {
            const items = dialog?.vendor?.items;
            return Array.isArray(items) && (itemKey === undefined || items.some((item: any) => item?.key === itemKey));
        });
        if (!vendorOffersItem || !Array.isArray(spawn?.points)) {
            return false;
        }

        return spawn.points.some((point: Position) => {
            if (!isFinitePosition(point)) {
                return false;
            }
            const x = playerPosition.x - point.x;
            const y = playerPosition.y - point.y;
            const z = playerPosition.z - point.z;
            return x * x + y * y + z * z <= maximumDistanceSquared;
        });
    });
}

export function isTrainerWithinRange(
    playerPosition: Position,
    spawns: unknown,
    abilityKey: unknown,
    maximumDistance = VENDOR_INTERACTION_DISTANCE
): boolean {
    if (
        !isFinitePosition(playerPosition) ||
        !Array.isArray(spawns) ||
        typeof abilityKey !== "string" ||
        abilityKey.length === 0 ||
        !Number.isFinite(maximumDistance) ||
        maximumDistance < 0
    ) {
        return false;
    }
    const maximumDistanceSquared = maximumDistance * maximumDistance;

    return spawns.some((spawn: any) => {
        const dialogs = Array.isArray(spawn?.interactable?.data) ? spawn.interactable.data : [];
        const trainerOffersAbility = dialogs.some((dialog: any) => {
            const abilities = dialog?.trainer?.abilities;
            return Array.isArray(abilities) && abilities.some((ability: any) => ability?.key === abilityKey);
        });
        if (!trainerOffersAbility || !Array.isArray(spawn?.points)) {
            return false;
        }

        return spawn.points.some((point: Position) => {
            if (!isFinitePosition(point)) {
                return false;
            }
            const x = playerPosition.x - point.x;
            const y = playerPosition.y - point.y;
            const z = playerPosition.z - point.z;
            return x * x + y * y + z * z <= maximumDistanceSquared;
        });
    });
}

export function isQuestProgressComplete(quest: Quest, playerQuest?: QuestProgress): boolean {
    return Boolean(
        quest &&
            playerQuest &&
            quest.type === QuestObjective.KILL_AMOUNT &&
            playerQuest.status === 0 &&
            playerQuest.qty >= quest.quantity
    );
}

export function getMaximumAbilityCost(ability: Ability, propertyKey: string): number {
    const effects = Array.isArray(ability?.casterPropertyAffected) ? ability.casterPropertyAffected : [];
    return effects.reduce((total, effect) => {
        if (effect?.key !== propertyKey || effect.type !== CalculationTypes.REMOVE) {
            return total;
        }
        const maximum = Number(effect.max ?? effect.min ?? 0);
        return Number.isFinite(maximum) && maximum > 0 ? total + maximum : total;
    }, 0);
}

export function hasSufficientAbilityResource(ability: Ability, propertyKey: string, availableValue: unknown): boolean {
    const available = Number(availableValue);
    const cost = getMaximumAbilityCost(ability, propertyKey);
    return Number.isFinite(available) && available >= 0 && available >= cost;
}

export function isAbilityCooldownReady(cooldownSlots: unknown, digit: unknown): boolean {
    return (
        Array.isArray(cooldownSlots) &&
        typeof digit === "number" &&
        Number.isSafeInteger(digit) &&
        digit >= 0 &&
        digit < cooldownSlots.length &&
        cooldownSlots[digit] !== true
    );
}

export function isSquaredDistanceWithinRange(distanceSquared: unknown, range: unknown): boolean {
    return (
        typeof distanceSquared === "number" &&
        Number.isFinite(distanceSquared) &&
        distanceSquared >= 0 &&
        typeof range === "number" &&
        Number.isFinite(range) &&
        range > 0 &&
        distanceSquared <= range * range
    );
}

export function canProcessDebugMessages(environment = process.env.NODE_ENV): boolean {
    return environment === "development" || environment === "test";
}

export function canProcessDefeat(ownerAlreadyDead: unknown, targetAlreadyDead: unknown, targetHealth: unknown): boolean {
    return (
        ownerAlreadyDead !== true &&
        targetAlreadyDead !== true &&
        typeof targetHealth === "number" &&
        Number.isFinite(targetHealth) &&
        targetHealth <= 0
    );
}

function isFinitePosition(value: Position): boolean {
    return Boolean(value && [value.x, value.y, value.z].every(Number.isFinite));
}
