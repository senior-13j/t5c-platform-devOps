import type { CorsOptions } from "cors";
import type { BeforeUpgradeHandler } from "@colyseus/core";

const PRODUCTION_ORIGINS = ["https://arkadii.world", "https://www.arkadii.world"];
export const MAX_WEBSOCKET_PAYLOAD_BYTES = 8 * 1024;
const DEVELOPMENT_ORIGINS = [
    ...PRODUCTION_ORIGINS,
    "https://arkadii.game.local",
    "http://localhost:3000",
    "http://localhost:8080",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:8080",
];

function normalizeHttpOrigin(value: string): string | null {
    try {
        const parsed = new URL(value.trim());
        if (
            (parsed.protocol !== "http:" && parsed.protocol !== "https:") ||
            parsed.username ||
            parsed.password ||
            (parsed.pathname && parsed.pathname !== "/") ||
            parsed.search ||
            parsed.hash
        ) {
            return null;
        }
        return parsed.origin;
    } catch {
        return null;
    }
}

export function resolveAllowedCorsOrigins(environment: NodeJS.ProcessEnv = process.env): ReadonlySet<string> {
    const configuredValue = String(environment.CORS_ALLOWED_ORIGINS ?? "").trim();
    const configured = configuredValue
        .split(",")
        .map((origin) => normalizeHttpOrigin(origin))
        .filter((origin): origin is string => Boolean(origin));
    const defaults = environment.NODE_ENV === "production" ? PRODUCTION_ORIGINS : DEVELOPMENT_ORIGINS;
    return new Set(configuredValue ? configured : defaults);
}

export function isCorsOriginAllowed(origin: string | undefined, allowedOrigins: ReadonlySet<string>): boolean {
    if (!origin) {
        // Server-to-server, CLI, same-origin and health-check requests may omit Origin.
        return true;
    }
    const normalized = normalizeHttpOrigin(origin);
    return normalized !== null && allowedOrigins.has(normalized);
}

export function createCorsOptions(environment: NodeJS.ProcessEnv = process.env): CorsOptions {
    const allowedOrigins = resolveAllowedCorsOrigins(environment);
    return {
        origin: (origin, callback) => callback(null, isCorsOriginAllowed(origin, allowedOrigins)),
        methods: ["GET", "HEAD", "POST", "OPTIONS"],
        allowedHeaders: ["Authorization", "Content-Type"],
        maxAge: 600,
        optionsSuccessStatus: 204,
    };
}

export function createWebSocketOriginGuard(environment: NodeJS.ProcessEnv = process.env): BeforeUpgradeHandler {
    const allowedOrigins = resolveAllowedCorsOrigins(environment);
    return (request) => {
        const origin = request.headers.get("origin") ?? undefined;
        if (!isCorsOriginAllowed(origin, allowedOrigins)) {
            return new Response("Forbidden WebSocket origin", { status: 403 });
        }
    };
}
