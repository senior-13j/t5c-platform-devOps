import { cp } from "node:fs/promises";

// `cp -r public dist` works in POSIX shells but is not available in cmd.exe.
// Keep the server build identical on Windows, macOS, and Linux.
await cp(
    new URL("../public", import.meta.url),
    new URL("../dist/public", import.meta.url),
    { recursive: true },
);
