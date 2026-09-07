import assert from "node:assert/strict";
import { test } from "node:test";

import { LocationsDB } from "../src/server/data/LocationsDB";
import loadNavMeshFromFile from "../src/server/utils/loadNavMeshFromFile";

test("every configured location navmesh parses from its exact file bytes", async () => {
    const navMeshes = new Map<string, Awaited<ReturnType<typeof loadNavMeshFromFile>>>();
    for (const location of Object.values(LocationsDB)) {
        const navMesh = await loadNavMeshFromFile(location.mesh);
        navMeshes.set(location.key, navMesh);
        assert.ok(navMesh, `Could not parse navmesh for ${location.key}`);
        assert.equal(typeof navMesh.findPath, "function");
        assert.ok(navMesh.regions.length > 0, `Navmesh has no regions for ${location.key}`);
    }

    for (const location of Object.values(LocationsDB)) {
        const sourceNavMesh = navMeshes.get(location.key)!;
        for (const transition of location.dynamic?.interactive ?? []) {
            if (transition.type !== "zone_change") {
                continue;
            }
            const destination = LocationsDB[transition.to_map];
            assert.ok(destination, `Unknown destination ${transition.to_map} from ${location.key}`);
            assert.ok(sourceNavMesh.getRegionForPoint(transition.from, 2), `Off-navmesh exit in ${location.key}`);
            assert.ok(
                navMeshes.get(destination.key)?.getRegionForPoint(transition.to_vector, 2),
                `Off-navmesh arrival in ${destination.key}`
            );
        }
    }
});

test("server navmesh loader rejects path traversal keys", async () => {
    await assert.rejects(loadNavMeshFromFile("../../database"), /Invalid navmesh key/);
});
