export const PLAYER_SESSION_RESERVATION_TTL_MS = 30_000;

type PlayerSessionEntry = {
    sessionId: string;
    state: "reserved" | "active";
    reservedAt: number;
};

const gameSessionByCharacterId = new Map<number, PlayerSessionEntry>();

function hasValidIdentifiers(characterId: number, sessionId: string): boolean {
    return Number.isSafeInteger(characterId) && characterId > 0 && typeof sessionId === "string" && sessionId.length > 0;
}

/**
 * Reserve a character during onAuth. This check-and-set is synchronous, making
 * concurrent authentication attempts atomic within a single Node process.
 */
export function reservePlayerSession(characterId: number, sessionId: string, now: number = Date.now()): boolean {
    if (!hasValidIdentifiers(characterId, sessionId)) {
        return false;
    }

    const existing = gameSessionByCharacterId.get(characterId);
    if (existing) {
        if (existing.sessionId === sessionId) {
            return true;
        }

        const reservationExpired =
            existing.state === "reserved" && now - existing.reservedAt >= PLAYER_SESSION_RESERVATION_TTL_MS;
        if (!reservationExpired) {
            return false;
        }
    }

    gameSessionByCharacterId.set(characterId, { sessionId, state: "reserved", reservedAt: now });
    return true;
}

export function activatePlayerSession(characterId: number, sessionId: string): boolean {
    const entry = gameSessionByCharacterId.get(characterId);
    if (!entry || entry.sessionId !== sessionId) {
        return false;
    }

    entry.state = "active";
    return true;
}

export function registerPlayerSession(characterId: number, sessionId: string): boolean {
    if (!reservePlayerSession(characterId, sessionId)) {
        return false;
    }
    return activatePlayerSession(characterId, sessionId);
}

export function unregisterPlayerSession(characterId: number, sessionId: string): boolean {
    if (gameSessionByCharacterId.get(characterId)?.sessionId !== sessionId) {
        return false;
    }

    return gameSessionByCharacterId.delete(characterId);
}

export function getPlayerSession(characterId: number): string | undefined {
    const entry = gameSessionByCharacterId.get(characterId);
    return entry?.state === "active" ? entry.sessionId : undefined;
}

export function ownsPlayerSession(characterId: number, sessionId: string): boolean {
    return gameSessionByCharacterId.get(characterId)?.sessionId === sessionId;
}

export type PlayerLeaveStage = "save" | "remove" | "offline";

export async function finalizePlayerSession(
    characterId: number,
    sessionId: string,
    actions: {
        save?: () => Promise<void>;
        remove: () => void | Promise<void>;
        markOffline?: () => Promise<void>;
        onError?: (stage: PlayerLeaveStage, error: unknown) => void;
    }
): Promise<boolean> {
    const ownsSession = ownsPlayerSession(characterId, sessionId);

    if (ownsSession && actions.save) {
        try {
            await actions.save();
        } catch (error) {
            actions.onError?.("save", error);
        }
    }

    try {
        await actions.remove();
    } catch (error) {
        actions.onError?.("remove", error);
    }

    if (ownsSession) {
        try {
            await actions.markOffline?.();
        } catch (error) {
            actions.onError?.("offline", error);
        } finally {
            unregisterPlayerSession(characterId, sessionId);
        }
    }

    return ownsSession;
}

export function clearPlayerSessions(): void {
    gameSessionByCharacterId.clear();
}
