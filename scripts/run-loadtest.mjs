import { spawn } from "node:child_process";

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const inheritedNodeOptions = process.env.NODE_OPTIONS || "";
const nodeOptions = inheritedNodeOptions.includes("--use-system-ca")
    ? inheritedNodeOptions
    : (inheritedNodeOptions + " --use-system-ca").trim();
const defaultArguments = ["tsx", "loadtest/chat.ts", "--room", "chat_room", "--numClients", "10", "--endpoint", "wss://arkadii.game.local"];
const child = spawn(npxCommand, [...defaultArguments, ...process.argv.slice(2)], {
    stdio: "inherit",
    env: { ...process.env, NODE_OPTIONS: nodeOptions },
});

child.on("exit", (code, signal) => {
    if (signal) {
        process.kill(process.pid, signal);
        return;
    }
    process.exitCode = code ?? 1;
});
