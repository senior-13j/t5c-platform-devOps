import { Room, Client } from "@colyseus/core";
import Logger from "../utils/Logger";
import { ServerMsg } from "../../shared/types";
import type { Database } from "../Database";
import { getPlayerSession } from "./PlayerSessionRegistry";

export const CHAT_MESSAGE_MAX_LENGTH = 280;
export const CHAT_NAME_MAX_LENGTH = 32;
export const CHAT_RATE_LIMIT_COUNT = 6;
export const CHAT_RATE_LIMIT_WINDOW_MS = 10_000;

export type ChatIdentity = {
    chatSessionId: string;
    characterId: number;
    name: string;
};

type ChatDatabase = Pick<Database, "getUserByToken" | "getCharacter">;

export function sanitizeChatText(value: unknown, maxLength: number): string {
    if (typeof value !== "string") {
        return "";
    }

    // Bound work before running regular expressions so oversized frames cannot
    // force the chat room to allocate memory proportional to attacker input.
    const normalized = value
        .slice(0, Math.max(maxLength * 4, maxLength))
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    return Array.from(normalized).slice(0, maxLength).join("");
}

export function createChatIdentity(chatSessionId: string, characterId: number, characterName: unknown): ChatIdentity {
    const name = sanitizeChatText(characterName, CHAT_NAME_MAX_LENGTH);
    return {
        chatSessionId,
        characterId,
        name: name || `Adventurer-${characterId}`,
    };
}

export async function authenticateChatIdentity(
    database: ChatDatabase | undefined,
    options: unknown,
    chatSessionId: string
): Promise<ChatIdentity | false> {
    const token = typeof (options as any)?.token === "string" ? (options as any).token.trim() : "";
    const rawCharacterId = (options as any)?.character_id;
    const characterId =
        typeof rawCharacterId === "number"
            ? rawCharacterId
            : typeof rawCharacterId === "string" && /^\d+$/.test(rawCharacterId.trim())
              ? Number(rawCharacterId)
              : Number.NaN;

    if (!database || !token || !Number.isSafeInteger(characterId) || characterId <= 0 || !chatSessionId) {
        return false;
    }

    try {
        const user = await database.getUserByToken(token);
        if (!user) {
            return false;
        }

        const character = await database.getCharacter(characterId);
        if (!character || Number(character.user_id) !== Number(user.id)) {
            return false;
        }

        return createChatIdentity(chatSessionId, characterId, character.name);
    } catch (error) {
        Logger.error("[chat_room][onAuth] authentication failed.", error);
        return false;
    }
}

export class ChatRateLimiter {
    private attempts = new Map<string | number, number[]>();
    private operations = 0;

    constructor(
        private readonly limit: number = CHAT_RATE_LIMIT_COUNT,
        private readonly windowMs: number = CHAT_RATE_LIMIT_WINDOW_MS
    ) {}

    allow(characterId: string | number, now: number = Date.now()): boolean {
        const windowStart = now - this.windowMs;
        this.operations += 1;
        if (this.operations % 1000 === 0 || this.attempts.size >= 10_000) {
            this.attempts.forEach((timestamps, key) => {
                if (!timestamps.some((timestamp) => timestamp > windowStart)) {
                    this.attempts.delete(key);
                }
            });
        }

        if (!this.attempts.has(characterId) && this.attempts.size >= 10_000) {
            return false;
        }

        const recentAttempts = (this.attempts.get(characterId) ?? []).filter((timestamp) => timestamp > windowStart);

        if (recentAttempts.length >= this.limit) {
            this.attempts.set(characterId, recentAttempts);
            return false;
        }

        recentAttempts.push(now);
        this.attempts.set(characterId, recentAttempts);
        return true;
    }

    remove(characterId: string | number): void {
        this.attempts.delete(characterId);
    }

    clear(): void {
        this.attempts.clear();
    }
}

// A process-wide limiter prevents reconnecting to another chat-room instance
// from resetting a character's message budget.
const sharedChatRateLimiter = new ChatRateLimiter();

export class ChatRoom extends Room {
    public maxClients = 1000;
    public maxMessagesPerSecond = 20;
    private database?: ChatDatabase;
    private identities = new Map<string, ChatIdentity>();
    private rateLimiter = sharedChatRateLimiter;

    setDatabase(database: ChatDatabase): void {
        this.database = database;
    }

    // When room is initialized
    onCreate(_options: any) {
        Logger.info("[chat_room][onCreate] room created.");

        this.autoDispose = true;

        //For chat
        this.onMessage(ServerMsg.PLAYER_SEND_MESSAGE, (client, message) => {
            this.handlePlayerMessage(client, message);
        });
    }

    async onAuth(client: Client, options: unknown) {
        const identity = await authenticateChatIdentity(this.database, options, client.sessionId);
        if (!identity) {
            Logger.warning("[chat_room][onAuth] rejected unauthenticated client.");
        }
        return identity;
    }

    // When client successfully join the room
    onJoin(client: Client, options: any, auth: any) {
        const identity = auth as ChatIdentity;
        if (!identity || identity.chatSessionId !== client.sessionId) {
            Logger.warning("[chat_room][onJoin] rejected client without a verified identity.");
            return;
        }
        this.identities.set(client.sessionId, identity);
        Logger.info("[chat_room][onJoin] client joined " + client.sessionId);
    }

    // When a client leaves the room
    onLeave(client: Client, _code?: number) {
        this.identities.delete(client.sessionId);
    }

    // Cleanup callback, called after there are no more clients in the room. (see `autoDispose`)
    onDispose() {
        this.identities.clear();
    }

    handlePlayerMessage(client: Pick<Client, "sessionId">, incomingMsg: any, now: number = Date.now()): boolean {
        const identity = this.identities.get(client.sessionId);
        if (!identity) {
            Logger.warning("[chat_room][message] rejected message from unknown client " + client.sessionId);
            return false;
        }

        if (!this.rateLimiter.allow(identity.characterId, now)) {
            Logger.warning("[chat_room][message] rate limit exceeded for character " + identity.characterId);
            return false;
        }

        const message = sanitizeChatText(incomingMsg?.message, CHAT_MESSAGE_MAX_LENGTH);
        if (!message) {
            return false;
        }

        const gameSessionId = getPlayerSession(identity.characterId);
        if (!gameSessionId) {
            Logger.warning("[chat_room][message] rejected message without an active game session " + client.sessionId);
            return false;
        }

        Logger.info("[chat_room][message] accepted message from " + client.sessionId);
        this.broadcast(ServerMsg.CHAT_MESSAGE, this.generateMessage(gameSessionId, identity.name, message));
        return true;
    }

    // prepare chat message to be sent
    generateMessage(sessionId: string = "system", name: string = "SYSTEM", message: string = "") {
        return {
            senderID: sessionId,
            name,
            message,
            timestamp: 0,
            createdAt: Date.now(),
        };
    }
}
