import { ServerMsg, type PlayerInputs } from "../../shared/types";

export const GAMEPLAY_MESSAGE_REFILL_PER_SECOND = 40;
export const GAMEPLAY_MESSAGE_BURST = 40;
export const GAMEPLAY_ACTION_REFILL_PER_SECOND = 8;
export const GAMEPLAY_ACTION_BURST = 8;
export const GAMEPLAY_MOVEMENT_REFILL_PER_SECOND = 10;
export const GAMEPLAY_MOVEMENT_BURST = 2;
export const GAMEPLAY_PING_REFILL_PER_SECOND = 1;
export const GAMEPLAY_PING_BURST = 2;
export const MAX_CLICK_TO_MOVE_DISTANCE = 64;
export const MAX_WORLD_COORDINATE = 10_000;
export const INVALID_GAMEPLAY_MESSAGE_CLOSE_CODE = 4002;

const CLIENT_MESSAGE_TYPES = new Set<number>([
    ServerMsg.PING,
    ServerMsg.PLAYER_RESET_POSITION,
    ServerMsg.PLAYER_RESSURECT,
    ServerMsg.PLAYER_LEARN_SKILL,
    ServerMsg.PLAYER_ADD_STAT_POINT,
    ServerMsg.PLAYER_MOVE,
    ServerMsg.PLAYER_MOVE_TO,
    ServerMsg.PLAYER_PICKUP,
    ServerMsg.PLAYER_DROP_ITEM,
    ServerMsg.PLAYER_USE_ITEM,
    ServerMsg.PLAYER_UNEQUIP_ITEM,
    ServerMsg.PLAYER_HOTBAR_ACTIVATED,
    ServerMsg.PLAYER_QUEST_UPDATE,
    ServerMsg.PLAYER_BUY_ITEM,
    ServerMsg.PLAYER_SELL_ITEM,
    ServerMsg.DEBUG_REMOVE_ENTITIES,
    ServerMsg.DEBUG_INCREASE_ENTITIES,
    ServerMsg.DEBUG_DECREASE_ENTITIES,
    ServerMsg.DEBUG_BOTS,
]);

type Bucket = {
    tokens: number;
    updatedAt: number;
};

type ClientBudget = {
    all: Bucket;
    actions: Bucket;
    movement: Bucket;
    ping: Bucket;
};

function consume(bucket: Bucket, capacity: number, refillPerSecond: number, now: number): boolean {
    const elapsedMs = Math.max(0, now - bucket.updatedAt);
    bucket.tokens = Math.min(capacity, bucket.tokens + (elapsedMs / 1000) * refillPerSecond);
    bucket.updatedAt = Math.max(bucket.updatedAt, now);
    if (bucket.tokens < 1) {
        return false;
    }
    bucket.tokens -= 1;
    return true;
}

export class GameplayMessageGuard {
    private clients = new Map<string, ClientBudget>();

    allow(sessionId: string, type: unknown, now: number = Date.now()): boolean {
        if (!sessionId || typeof type !== "number" || !Number.isInteger(type) || !CLIENT_MESSAGE_TYPES.has(type)) {
            return false;
        }

        let budget = this.clients.get(sessionId);
        if (!budget) {
            budget = {
                all: { tokens: GAMEPLAY_MESSAGE_BURST, updatedAt: now },
                actions: { tokens: GAMEPLAY_ACTION_BURST, updatedAt: now },
                movement: { tokens: GAMEPLAY_MOVEMENT_BURST, updatedAt: now },
                ping: { tokens: GAMEPLAY_PING_BURST, updatedAt: now },
            };
            this.clients.set(sessionId, budget);
        }

        if (!consume(budget.all, GAMEPLAY_MESSAGE_BURST, GAMEPLAY_MESSAGE_REFILL_PER_SECOND, now)) {
            return false;
        }
        if (type === ServerMsg.PLAYER_MOVE || type === ServerMsg.PLAYER_MOVE_TO) {
            return consume(budget.movement, GAMEPLAY_MOVEMENT_BURST, GAMEPLAY_MOVEMENT_REFILL_PER_SECOND, now);
        }
        if (type === ServerMsg.PING) {
            return consume(budget.ping, GAMEPLAY_PING_BURST, GAMEPLAY_PING_REFILL_PER_SECOND, now);
        }
        return consume(budget.actions, GAMEPLAY_ACTION_BURST, GAMEPLAY_ACTION_REFILL_PER_SECOND, now);
    }

    remove(sessionId: string): void {
        this.clients.delete(sessionId);
    }

    clear(): void {
        this.clients.clear();
    }
}

export function getPingTimestamp(data: unknown): number | null {
    const value = typeof data === "number" ? data : (data as { date?: unknown } | null)?.date;
    return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

export function dispatchGameplayMessageSafely(
    state: { processMessage(client: unknown, type: unknown, data: unknown): unknown },
    client: { leave(code?: number, data?: string): void },
    type: unknown,
    data: unknown,
    onError: (error: unknown) => void = () => undefined
): boolean {
    try {
        state.processMessage(client, type, data);
        return true;
    } catch (error) {
        onError(error);
        client.leave(INVALID_GAMEPLAY_MESSAGE_CLOSE_CODE, "Invalid gameplay message");
        return false;
    }
}

export function normalizeMovementInput(input: unknown, currentSequence: number): PlayerInputs | null {
    const candidate = input as Partial<PlayerInputs> | null;
    const sequence = candidate?.seq;
    const horizontal = candidate?.h;
    const vertical = candidate?.v;
    if (
        typeof sequence !== "number" ||
        !Number.isSafeInteger(sequence) ||
        sequence <= currentSequence ||
        typeof horizontal !== "number" ||
        !Number.isFinite(horizontal) ||
        typeof vertical !== "number" ||
        !Number.isFinite(vertical)
    ) {
        return null;
    }

    const magnitude = Math.hypot(horizontal, vertical);
    if (!Number.isFinite(magnitude) || magnitude < 0.001) {
        return null;
    }
    const scale = magnitude > 1 ? 1 / magnitude : 1;
    return { seq: sequence, h: horizontal * scale, v: vertical * scale };
}

export function isMovementDisplacementAllowed(
    source: { x: number; y: number; z: number },
    destination: { x: number; y: number; z: number },
    maximumHorizontalDistance: number
): boolean {
    if (
        ![source.x, source.y, source.z, destination.x, destination.y, destination.z, maximumHorizontalDistance].every(
            Number.isFinite
        ) ||
        maximumHorizontalDistance < 0
    ) {
        return false;
    }
    return Math.hypot(destination.x - source.x, destination.z - source.z) <= maximumHorizontalDistance + 1e-6;
}

export function isClickToMoveTargetAllowed(
    source: { x: number; y: number; z: number },
    destination: { x: number; y: number; z: number },
    maximumDistance: number = MAX_CLICK_TO_MOVE_DISTANCE
): boolean {
    const coordinates = [source.x, source.y, source.z, destination.x, destination.y, destination.z];
    if (
        !coordinates.every((value) => Number.isFinite(value) && Math.abs(value) <= MAX_WORLD_COORDINATE) ||
        !Number.isFinite(maximumDistance) ||
        maximumDistance < 0
    ) {
        return false;
    }

    return (
        Math.hypot(destination.x - source.x, destination.y - source.y, destination.z - source.z) <= maximumDistance + 1e-6
    );
}
