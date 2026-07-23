import assert from "node:assert/strict";
import { test } from "node:test";
import { LocationsDB } from "../src/server/data/LocationsDB";

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

test("the training ground has a safe exit back to Lighthaven", () => {
    const entrance = zoneChanges(LocationsDB.lh_town).find((transition) => transition.to_map === "training_ground");
    const exit = zoneChanges(LocationsDB.training_ground).find((transition) => transition.to_map === "lh_town");

    assert.ok(entrance, "Lighthaven must lead to the training ground");
    assert.ok(exit, "The training ground must lead back to Lighthaven");
    assert.ok(exit.to_map in LocationsDB, `Unknown training-ground exit destination: ${exit.to_map}`);
    assert.ok(exit.from.distanceTo(entrance.to_vector) > 2, "The exit overlaps the training-ground arrival point");
    assert.ok(exit.to_vector.distanceTo(entrance.from) > 2, "The town arrival point overlaps the training-ground entrance");
});
