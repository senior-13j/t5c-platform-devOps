///////////////////////////////////////////////////////////
// CAPTAIN OBVIOUS HERE:
// this can only be used in a NODE ENVIRONMENT, do not use to import in the client as fs is not available.

import fs from "fs";
import path from "path";
import { NavMeshLoader, NavMesh } from "../../shared/Libs/yuka-min";

export default async function loadNavMeshFromFile(fileNameNavMesh: string): Promise<NavMesh> {
    if (typeof fileNameNavMesh !== "string" || !/^[a-z0-9_-]+$/i.test(fileNameNavMesh)) {
        throw new Error("Invalid navmesh key.");
    }

    const url = path.join(__dirname, "../../../public/models/navmesh/" + fileNameNavMesh + ".glb");
    const data = await fs.promises.readFile(url);
    // Node Buffers may be views into a larger pooled ArrayBuffer. Passing the
    // backing slab makes the GLB parser read unrelated trailing bytes.
    const arrayBuffer = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) as ArrayBuffer;
    const loader = new NavMeshLoader();
    return loader.parse(arrayBuffer, "", { mergeConvexRegions: false });
}
