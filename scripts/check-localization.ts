import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { AbilitiesDB } from "../src/server/data/AbilitiesDB";
import { HelpDB } from "../src/server/data/HelpDB";
import { ItemsDB } from "../src/server/data/ItemDB";
import { LocationsDB } from "../src/server/data/LocationsDB";
import { QuestsDB } from "../src/server/data/QuestsDB";
import { RacesDB } from "../src/server/data/RacesDB";
import {
    gameContent,
    localizeGameData,
    localizeServerMessage,
    t,
    translations,
    type Locale,
} from "../src/client/i18n";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const locales: Locale[] = ["en", "ru"];

function sortedKeys(value: object): string[] {
    return Object.keys(value).sort();
}

function assertMatchingKeys(label: string, source: object, localized: object): void {
    assert.deepEqual(sortedKeys(localized), sortedKeys(source), `${label} localization keys do not match game data`);
}

function placeholders(value: string): string[] {
    return [...value.matchAll(/\{([A-Za-z0-9_]+)\}/g)].map((match) => match[1]).sort();
}

function validateLocalizedPairs(value: unknown, objectPath = "gameContent"): number {
    if (!value || typeof value !== "object") {
        return 0;
    }

    const candidate = value as Record<string, unknown>;
    if (typeof candidate.en === "string" && typeof candidate.ru === "string") {
        assert.ok(candidate.en.trim(), `${objectPath}.en is empty`);
        assert.ok(candidate.ru.trim(), `${objectPath}.ru is empty`);
        assert.notEqual(candidate.en, candidate.ru, `${objectPath} has an untranslated Russian value`);
        return 1;
    }

    return Object.entries(candidate).reduce(
        (count, [key, child]) => count + validateLocalizedPairs(child, `${objectPath}.${key}`),
        0
    );
}

async function collectTypeScriptFiles(directory: string): Promise<string[]> {
    const entries = await readdir(directory, { withFileTypes: true });
    const files = await Promise.all(
        entries.map(async (entry) => {
            const entryPath = path.join(directory, entry.name);
            if (entry.isDirectory()) {
                return collectTypeScriptFiles(entryPath);
            }
            return entry.isFile() && entry.name.endsWith(".ts") ? [entryPath] : [];
        })
    );
    return files.flat();
}

async function main(): Promise<void> {
    assertMatchingKeys("UI", translations.en, translations.ru);
    for (const key of sortedKeys(translations.en)) {
        assert.deepEqual(
            placeholders(translations.ru[key]),
            placeholders(translations.en[key]),
            `Placeholder mismatch for ${key}`
        );
        for (const locale of locales) {
            const params = Object.fromEntries(placeholders(translations[locale][key]).map((name) => [name, "test"]));
            assert.doesNotMatch(
                t(locale, key, params),
                /\{[A-Za-z0-9_]+\}/,
                `Unresolved placeholder for ${locale}.${key}`
            );
        }
    }

    assertMatchingKeys("Ability", AbilitiesDB, gameContent.abilities);
    assertMatchingKeys("Item", ItemsDB, gameContent.items);
    assertMatchingKeys("Race", RacesDB, gameContent.races);
    assertMatchingKeys("Quest", QuestsDB, gameContent.quests);
    assertMatchingKeys("Location", LocationsDB, gameContent.locations);
    assertMatchingKeys("Location entity", LocationsDB, gameContent.entities);

    for (const [locationKey, location] of Object.entries(LocationsDB) as Array<[string, any]>) {
        const sourceSpawns = Object.fromEntries((location.dynamic?.spawns ?? []).map((spawn: any) => [spawn.key, spawn]));
        const localizedSpawns = (gameContent.entities as any)[locationKey];
        assertMatchingKeys(`${locationKey} entity`, sourceSpawns, localizedSpawns);

        for (const [spawnKey, spawn] of Object.entries(sourceSpawns) as Array<[string, any]>) {
            const content = localizedSpawns[spawnKey];
            assert.ok(content.name, `Missing localized name for ${locationKey}.${spawnKey}`);
            if (!spawn.interactable) {
                continue;
            }

            const dialogs = spawn.interactable.data ?? [];
            assert.equal(content.dialog?.length, dialogs.length, `Dialog count mismatch for ${locationKey}.${spawnKey}`);
            dialogs.forEach((dialog: any, dialogIndex: number) => {
                assert.ok(content.dialog[dialogIndex], `Missing dialog ${dialogIndex} for ${locationKey}.${spawnKey}`);
                (dialog.buttons ?? []).forEach((_button: any, buttonIndex: number) => {
                    assert.ok(content.buttons?.[buttonIndex], `Missing button ${buttonIndex} for ${locationKey}.${spawnKey}`);
                });
                if (dialog.buttonName) {
                    assert.ok(content.buttonNames?.[dialogIndex], `Missing final button for ${locationKey}.${spawnKey}`);
                }
            });
        }
    }

    assert.equal(HelpDB.tab_01.objects.length, 5, "The localized help layout expects five sections");
    const localizedPairCount = validateLocalizedPairs(gameContent);

    const localizedData = localizeGameData(
        {
            abilities: structuredClone(AbilitiesDB),
            items: structuredClone(ItemsDB),
            races: structuredClone(RacesDB),
            quests: structuredClone(QuestsDB),
            locations: structuredClone(LocationsDB),
            help: structuredClone(HelpDB),
        },
        "ru",
        "touch"
    );

    assert.equal(localizedData.abilities.base_attack.title, gameContent.abilities.base_attack.title.ru);
    assert.equal(localizedData.items.sword_01.description, gameContent.items.sword_01.description.ru);
    assert.equal(localizedData.races.humanoid.title, gameContent.races.humanoid.title.ru);
    assert.equal(
        localizedData.quests.LH_DANGEROUS_ERRANDS_01.objective,
        gameContent.quests.LH_DANGEROUS_ERRANDS_01.objective.ru
    );
    assert.equal(
        localizedData.locations.lh_town.dynamic.spawns[0].name,
        gameContent.entities.lh_town.lh_town_blacksmith.name.ru
    );
    assert.equal(localizedData.help.tab_01.objects[1].description, gameContent.help.movementTouch.ru);
    assert.equal(
        localizeServerMessage("You've gained knowledge and are now level 3.", "ru"),
        "Вы обрели новые знания и достигли 3-го уровня."
    );
    assert.equal(localizeServerMessage("You've killed Skeleton.", "ru"), "Вы победили противника: Скелет.");

    const html = await readFile(path.join(root, "public", "index.html"), "utf8");
    const htmlKeys = [...html.matchAll(/data-i18n(?:-aria-label|-title)?="([^"]+)"/g)].map((match) => match[1]);
    for (const key of htmlKeys) {
        assert.ok(key in translations.en, `Unknown HTML localization key: ${key}`);
    }

    const sourceFiles = await collectTypeScriptFiles(path.join(root, "src", "client"));
    let literalCallCount = 0;
    for (const file of sourceFiles) {
        const source = await readFile(file, "utf8");
        for (const match of source.matchAll(/\.t\(\s*["'`]([^"'`]+)["'`]/g)) {
            if (match[1].includes("${")) {
                continue;
            }
            literalCallCount++;
            assert.ok(match[1] in translations.en, `Unknown localization key ${match[1]} in ${path.relative(root, file)}`);
        }
    }

    console.log(
        `Localization checks passed (${sortedKeys(translations.en).length} UI keys, ${localizedPairCount} content pairs, ${htmlKeys.length} HTML bindings, ${literalCallCount} typed calls).`
    );
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
