import { rm } from "node:fs/promises";

// Preserve the independently built browser bundle while ensuring TypeScript
// output and server-side public assets cannot retain files deleted in source.
await Promise.all([
    rm(new URL("../dist/server", import.meta.url), { recursive: true, force: true }),
    rm(new URL("../dist/public", import.meta.url), { recursive: true, force: true }),
]);
