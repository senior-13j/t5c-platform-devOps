import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { AbilitiesDB } from "../src/server/data/AbilitiesDB";
import { ItemsDB } from "../src/server/data/ItemDB";
import { LocationsDB } from "../src/server/data/LocationsDB";
import { RacesDB } from "../src/server/data/RacesDB";

function requireAsset(relativePath: string, owner: string): void {
    assert.ok(existsSync(path.resolve(process.cwd(), "public", relativePath)), `${owner} references missing public/${relativePath}`);
}

test("active game data references only present runtime assets", () => {
    for (const ability of Object.values(AbilitiesDB)) {
        requireAsset(`images/icons/${ability.icon}.png`, `ability ${ability.key}`);
        requireAsset(`sounds/${ability.sound}.wav`, `ability ${ability.key}`);
    }

    for (const item of Object.values(ItemsDB)) {
        requireAsset(`images/icons/${item.icon}.png`, `item ${item.key}`);
        requireAsset(`models/items/${item.model}.glb`, `item ${item.key}`);
    }

    for (const race of Object.values(RacesDB)) {
        requireAsset(`images/portrait/${race.icon}.png`, `race ${race.key}`);
        requireAsset(`models/races/${race.key}.glb`, `race ${race.key}`);
        requireAsset(`models/races/${race.vat.key}.glb`, `race ${race.key} VAT`);
        requireAsset(`models/races/vat/${race.vat.key}.json`, `race ${race.key} VAT`);
    }

    for (const location of Object.values(LocationsDB)) {
        requireAsset(`models/environment/${location.mesh}.glb`, `location ${location.key}`);
        requireAsset(`models/navmesh/${location.mesh}.glb`, `location ${location.key}`);
    }
});
