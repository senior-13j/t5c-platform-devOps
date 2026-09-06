export type PlayerPersistenceSnapshot = {
    location: string;
    x: number;
    y: number;
    z: number;
    rot: number;
    level: number;
    maxHealth: number;
    maxMana: number;
    player_data: {
        gold: number;
        experience: number;
        points: number;
        strength: number;
        endurance: number;
        agility: number;
        intelligence: number;
        wisdom: number;
    };
    inventory: Array<{ key: string; qty: number }>;
    abilities: Array<{ key: string }>;
    equipment: Array<{ key: string; slot: number }>;
    quests: Array<{ key: string; status: number; qty: number }>;
    hotbar: Array<{ digit: number; type: string; key: string }>;
};

type PersistablePlayer = {
    location: string;
    x: number;
    y: number;
    z: number;
    rot: number;
    level: number;
    statsCTRL: { getStat(key: string): number };
    player_data: any;
    equipment: { values(): IterableIterator<any> };
};

type PersistenceDatabase = {
    savePlayerSnapshot(characterId: number, snapshot: PlayerPersistenceSnapshot): Promise<unknown>;
};

export function createPlayerPersistenceSnapshot(player: PersistablePlayer): PlayerPersistenceSnapshot {
    return {
        location: player.location,
        x: player.x,
        y: player.y,
        z: player.z,
        rot: player.rot,
        level: player.level,
        maxHealth: player.statsCTRL.getStat("maxHealth"),
        maxMana: player.statsCTRL.getStat("maxMana"),
        player_data: {
            gold: player.player_data.gold,
            experience: player.player_data.experience,
            points: player.player_data.points,
            strength: player.statsCTRL.getStat("strength"),
            endurance: player.statsCTRL.getStat("endurance"),
            agility: player.statsCTRL.getStat("agility"),
            intelligence: player.statsCTRL.getStat("intelligence"),
            wisdom: player.statsCTRL.getStat("wisdom"),
        },
        inventory: Array.from(player.player_data.inventory.values(), ({ key, qty }: any) => ({ key, qty })),
        abilities: Array.from(player.player_data.abilities.values(), ({ key }: any) => ({ key })),
        equipment: Array.from(player.equipment.values(), ({ key, slot }: any) => ({ key, slot })),
        quests: Array.from(player.player_data.quests.values(), ({ key, status, qty }: any) => ({ key, status, qty })),
        hotbar: Array.from(player.player_data.hotbar.values(), ({ digit, type, key }: any) => ({ digit, type, key })),
    };
}

export async function persistPlayerSnapshot(
    database: PersistenceDatabase,
    characterId: number,
    snapshot: PlayerPersistenceSnapshot
): Promise<void> {
    // Database owns the transaction so every destructive relation replacement
    // either commits together with the character row or is rolled back.
    await database.savePlayerSnapshot(characterId, snapshot);
}
