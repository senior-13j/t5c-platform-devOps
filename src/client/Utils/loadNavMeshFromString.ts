import { NavMesh, NavMeshLoader } from "../../shared/Libs/yuka-min";
import { assetUrl } from ".";

export default async function loadNavMeshFromString(fileNameNavMesh: string): Promise<NavMesh> {
    let url = assetUrl("models/navmesh/" + fileNameNavMesh + ".glb");
    const loader = new NavMeshLoader();
    return loader.load(url, { mergeConvexRegions: false }).then((navMesh) => {
        return navMesh;
    });
}
