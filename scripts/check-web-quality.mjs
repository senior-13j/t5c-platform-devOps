import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const publicDir = path.join(root, "public");
const docsDir = path.join(root, "docs");
const html = await readFile(path.join(publicDir, "index.html"), "utf8");

const requiredPatterns = new Map([
    ["document language", /<html[^>]+lang="en"/i],
    ["meta description", /<meta[^>]+name="description"/i],
    ["canonical URL", /<link[^>]+rel="canonical"[^>]+https:\/\/arkadii\.world\/game\//i],
    ["main landmark", /<main\b/i],
    ["page heading", /<h1\b/i],
    ["accessible game canvas", /<canvas[^>]+aria-label=/i],
    ["accessible login form", /<form[^>]+id="loginForm"/i],
    ["entry preference dialog", /id="entrySetupOverlay"[\s\S]{0,300}role="dialog"/i],
    ["English and Russian choices", /name="locale" value="en"[\s\S]+name="locale" value="ru"/i],
    ["keyboard and touch choices", /name="controlMode" value="keyboard"[\s\S]+name="controlMode" value="touch"/i],
    ["loading progress", /role="progressbar"/i],
    ["startup error state", /id="fatalError"/i],
    ["web app manifest", /rel="manifest"/i],
]);

for (const [label, pattern] of requiredPatterns) {
    assert.match(html, pattern, `Missing ${label}`);
}

const structuredDataMatch = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/i);
assert.ok(structuredDataMatch, "Missing JSON-LD structured data");
const structuredData = JSON.parse(structuredDataMatch[1]);
assert.equal(structuredData["@type"], "VideoGame");
assert.equal(structuredData.url, "https://arkadii.world/game/");
assert.deepEqual(structuredData.inLanguage, ["en", "ru"]);

const manifest = JSON.parse(await readFile(path.join(publicDir, "manifest.webmanifest"), "utf8"));
assert.equal(manifest.start_url, "./");
assert.equal(manifest.display, "fullscreen");
assert.ok(manifest.icons?.length > 0, "Manifest must include an icon");

const robots = await readFile(path.join(publicDir, "robots.txt"), "utf8");
assert.match(robots, /Allow: \/game\//);
assert.match(robots, /Sitemap: https:\/\/arkadii\.world\/sitemap\.xml/);

const sitemap = await readFile(path.join(publicDir, "sitemap.xml"), "utf8");
assert.match(sitemap, /<loc>https:\/\/arkadii\.world\/game\/<\/loc>/);

const llms = await readFile(path.join(publicDir, "llms.txt"), "utf8");
assert.match(llms, /https:\/\/arkadii\.world\/game\/docs\/#api_and_security/);
assert.match(llms, /https:\/\/arkadii\.world\/game\/docs\/#game_quality_audit/);
assert.match(llms, /https:\/\/arkadii\.world\/game\/docs\/#localization_and_controls/);

const docsIndex = await readFile(path.join(publicDir, "docs", "index.html"), "utf8");
const docsScript = await readFile(path.join(publicDir, "docs", "docs.js"), "utf8");
const requiredDocs = [
    "README.md",
    "PROJECT.md",
    "LOCALIZATION_AND_CONTROLS.md",
    "API_AND_SECURITY.md",
    "GAME_QUALITY_AUDIT.md",
    "INFRASTRUCTURE_AND_DEPLOYMENT.md",
    "CROSS_PLATFORM.md",
    "PUBLIC_DEPLOYMENT.md",
];

for (const document of requiredDocs) {
    await access(path.join(docsDir, document));
    assert.ok(docsScript.includes(`file: "${document}"`), `Docs loader is missing ${document}`);
    assert.ok(docsIndex.includes(`data-doc="${document}"`), `Docs navigation is missing ${document}`);
}

const localReferences = [...html.matchAll(/\b(?:href|src)="(\.\/[^"?#]+)"/g)]
    .map((match) => match[1].replace(/^\.\//, ""))
    .filter((reference) => reference !== "js/bundle.js");

await Promise.all(
    [...new Set(localReferences)].map(async (reference) => {
        await access(path.join(publicDir, reference));
    })
);

console.log(
    `Web quality checks passed (${requiredPatterns.size} semantics, ${localReferences.length} local references, ${requiredDocs.length} served docs).`
);
