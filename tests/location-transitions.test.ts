import assert from "node:assert/strict";
import { test } from "node:test";
import { LocationsDB } from "../src/server/data/LocationsDB";
import { RacesDB } from "../src/server/data/RacesDB";

type ZoneChange = {
    type: "zone_change";
    from: { distanceTo(other: unknown): number };
    to_map: string;
    to_vector: { distanceTo(other: unknown): number };
};

function zoneChanges(location: { dynamic?: { interactive?: unknown[] } }): ZoneChange[] {
    return (location.dynamic?.interactive ?? []).filter(
        (interactive): interactive is ZoneChange =>
            typeof interactive === "object" && interactive !== null && (interactive as ZoneChange).type === "zone_change"
    );
}

test("the Adventurer's Yard has a safe exit back to Oakwatch", () => {
    const entrance = zoneChanges(LocationsDB.lh_town).find((transition) => transition.to_map === "training_ground");
    const exit = zoneChanges(LocationsDB.training_ground).find((transition) => transition.to_map === "lh_town");

    assert.ok(entrance, "Oakwatch must lead to the Adventurer's Yard");
    assert.ok(exit, "The Adventurer's Yard must lead back to Oakwatch");
    assert.ok(exit.to_map in LocationsDB, `Unknown training-ground exit destination: ${exit.to_map}`);
    assert.ok(exit.from.distanceTo(entrance.to_vector) > 2, "The exit overlaps the training-ground arrival point");
    assert.ok(exit.to_vector.distanceTo(entrance.from) > 2, "The town arrival point overlaps the training-ground entrance");
});

test("the Old Barrow has a reachable, non-looping route from Oakwatch", () => {
    const entrance = zoneChanges(LocationsDB.lh_town).find((transition) => transition.to_map === "lh_dungeon_01");
    const exit = zoneChanges(LocationsDB.lh_dungeon_01).find((transition) => transition.to_map === "lh_town");

    assert.ok(entrance, "Oakwatch must lead to the Old Barrow");
    assert.ok(exit, "The Old Barrow must lead back to Oakwatch");
    assert.ok(exit.from.distanceTo(entrance.to_vector) > 2, "The barrow exit overlaps its arrival point");
    assert.ok(exit.to_vector.distanceTo(entrance.from) > 2, "The town return overlaps the barrow entrance");
});

test("every configured world spawn uses a playable server race", () => {
    for (const [locationKey, location] of Object.entries(LocationsDB)) {
        for (const transition of zoneChanges(location)) {
            assert.ok(transition.to_map in LocationsDB, `Unknown destination ${transition.to_map} in ${locationKey}`);
        }
        for (const spawn of location.dynamic?.spawns ?? []) {
            assert.ok(spawn.race in RacesDB, `Unknown race ${spawn.race} in ${locationKey}/${spawn.key}`);
        }
    }
});
