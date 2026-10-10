import { execFileSync } from "node:child_process";
import { promises as dns } from "node:dns";
import { existsSync, readFileSync } from "node:fs";
import { platform } from "node:os";
import path from "node:path";

function parseEnvFile(filePath) {
    const values = {};
    if (!existsSync(filePath)) {
        return values;
    }

    for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
        const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
        if (match && !line.trimStart().startsWith("#")) {
            values[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
        }
    }
    return values;
}

function optionValue(name) {
    const index = process.argv.indexOf(name);
    return index === -1 ? undefined : process.argv[index + 1];
}

function normalizePath(value) {
    const trimmed = String(value || "").replace(/^\/+|\/+$/g, "");
    return trimmed ? "/" + trimmed : "";
}

function lines(values) {
    return values.length > 0 ? values.join("\n") : "none";
}

function commandOutput(command, args) {
    try {
        return execFileSync(command, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
    } catch {
        return "";
    }
}

function listenersForPort(port) {
    if (platform() === "win32") {
        return commandOutput("netstat.exe", ["-ano", "-p", "tcp"])
            .split(/\r?\n/)
            .filter((line) => new RegExp(":" + port + "\\s+.*LISTENING", "i").test(line));
    }

    return commandOutput("ss", ["-ltnp"])
        .split(/\r?\n/)
        .filter((line) => line.endsWith(":" + port) || line.includes(":" + port + " "));
}

async function resolve(host, resolver) {
    try {
        return await resolver(host);
    } catch {
        return [];
    }
}

const requestedEnvFile = optionValue("--env-file") || process.argv.slice(2).find((argument) => !argument.startsWith("--")) || ".env.public";
const envFile = path.resolve(process.cwd(), requestedEnvFile);
const environment = parseEnvFile(envFile);
const appDomain = environment.APP_DOMAIN || "arkadii.world";
const appBasePath = normalizePath(environment.APP_BASE_PATH || "/game");
const publicBind = environment.PUBLIC_BIND || "0.0.0.0";
const httpPort = Number(environment.HTTP_PORT || 80);
const httpsPort = Number(environment.HTTPS_PORT || 443);
const appUrl = "https://" + appDomain + appBasePath + "/";

if (!existsSync(envFile)) {
    console.log("No " + requestedEnvFile + " file found. Using built-in public defaults.");
}

console.log("Public deployment readiness");
console.log("Domain:       " + appDomain);
console.log("Game URL:     " + appUrl);
console.log("Bind address: " + publicBind);
console.log("Ports:        " + httpPort + "/tcp and " + httpsPort + "/tcp");
console.log();

for (const port of [httpPort, httpsPort]) {
    const listeners = listenersForPort(port);
    if (listeners.length > 0) {
        console.log("WARN: port " + port + " is already listening on this host:");
        console.log(lines(listeners));
        console.log();
    }
}

const [publicIp, rootA, rootAaaa, wwwA, wwwCname] = await Promise.all([
    fetch("https://api.ipify.org").then((response) => response.ok ? response.text() : "").catch(() => ""),
    resolve(appDomain, dns.resolve4),
    resolve(appDomain, dns.resolve6),
    resolve("www." + appDomain, dns.resolve4),
    resolve("www." + appDomain, dns.resolveCname),
]);

console.log("Detected host public IPv4: " + (publicIp || "unknown"));
console.log();
console.log(appDomain + " A records:");
console.log(lines(rootA));
console.log();
console.log(appDomain + " AAAA records:");
console.log(lines(rootAaaa));
console.log();
console.log("www." + appDomain + " A/CNAME records:");
console.log(lines([...wwwA, ...wwwCname]));
console.log();

if (rootA.length === 0 && rootAaaa.length === 0) {
    console.error("BLOCKED: " + appDomain + " does not resolve yet.");
    console.error("Create DNS A/AAAA records pointing to this host before starting the public stack.");
    process.exitCode = 1;
} else {
    if (publicIp && rootA.length > 0 && !rootA.includes(publicIp)) {
        console.warn("WARN: " + appDomain + " A record does not match this host public IPv4 (" + publicIp + ").");
    }
    if (wwwA.length === 0 && wwwCname.length === 0) {
        console.warn("WARN: www." + appDomain + " does not resolve. The apex domain can still work, but www redirect will not.");
    }
    console.log("DNS readiness check complete.");
    console.log();
    console.log("Next command:");
    console.log("docker compose --env-file .env.public -f docker-compose.public.yml up -d --build");
}
