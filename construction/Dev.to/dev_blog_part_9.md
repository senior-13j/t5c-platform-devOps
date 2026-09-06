# Devlog Part 9 - Oakwatch Level Design

Hi all,

After resolving most of the animation issues I was having, I decided to relax
and work on level design. The goal was to create enough content to bring the
player from level 1 to level 10, with an intentionally grindy RPG feel.

## Preparation Is Key

Before starting level design, I wanted a clear list of locations, enemies, and
characters.

I already had a good idea of the world, but it took a while to write everything
down and clean up the structure. The current starting point is:

> Oakwatch is a weathered village nestled between lush forests and towering mountains in Arkadia.

### Locations

- **Forge**: The heart of Oakwatch's craftsmanship, where Blacksmith Garin forges weapons and armor.
- **Temple**: A sanctuary dedicated to Athlea, watched over by Priestess Alice, near the entrance to the skeleton-haunted Old Barrow.
- **Farm**: A sprawling field tended by Farmer Jorin, who provides food for the village.
- **Tavern**: The lively hub of Oakwatch, run by Bartender Morin, where stories and quests are exchanged.
- **Market**: A busy trading area where Merchant Elara sells potions and jewelry.
- **Mountains**: A majestic and foreboding range that houses the entrance to the Cave dungeon.
- **Cemetery**: A somber place tended by Caretaker Ren and the entrance to the Mausoleum dungeon.
- **Forest**: A dense, dark area occupied by Bandits and used for many outdoor trials.
- **Sorceress Tower**: The home of Sorceress Mira, where adventurers can learn offensive magic.
- **Velvet Veil**: A warm, luxurious establishment known for hospitality, ambiance, and performances.
- **Port**: A future area for expansion and additional quests.

### Dungeons

- **Old Barrow**: Beyond the Temple cemetery, haunted by skeletons and tuned for novice adventurers.
- **Mausoleum**: In the Cemetery, filled with powerful Skeletons for a greater challenge.
- **Cave**: In the Mountains, housing Mummies for the most seasoned early-game heroes.

### People

- **Blacksmith Garin**: A master of the forge and source of essential equipment.
- **Merchant Elara**: A trader in potions and enchanted items.
- **Sorceress Mira**: A mage trainer for offensive magic.
- **Priestess Alice**: A priestess who teaches defensive spells and seeks help for the Temple.
- **Farmer Jorin**: A farmer with room for future stories.
- **Bartender Morin**: The tavern keeper and source of many quests.
- **Caretaker Ren**: Guardian of the cemetery and keeper of Mausoleum secrets.
- **Madame Seraphina**: Proprietor of the Velvet Veil.

### Enemies

- **Barrow Skeletons**: Old Barrow enemies for heroes levels 1-3.
- **Skeletons**: Mausoleum enemies for heroes levels 3-6.
- **Bandits**: Forest enemies for heroes levels 6-8.
- **Mummies**: Cave enemies for heroes levels 8-10.

## Level Design Workflow

Once the content structure was clear, I moved into level design. The workflow
from Unity to Babylon.js looks like this:

1. Build the level in the Unity editor.
2. Export the scene as GLB.
3. Optimize the GLB with <https://gltf.report/>. Scene size can drop from
   roughly 2-3 MB to around 100 KB.
4. Generate a Unity navmesh.
5. Export the navmesh to OBJ.
6. Import the OBJ into Blender for cleanup and optimization.
7. Export the final navmesh as GLB for server and client use.

> For the LOD system to work well, meshes should not be too large on the
> horizontal axis. Otherwise, players may see large objects disappear when they
> should still be visible.

## Result

After a good amount of work, I managed to fit everything into a relatively small
area, which suits the current scope. The idea is to keep the map tight and
condensed while leaving room for natural iteration.

Open items:

- Move the farm closer to the mountain instead of keeping it in the village center.
- Place the market closer to the town center.
- Revisit the Velvet Veil placement in front of the Temple.

![Early planning map for Oakwatch](../map_eldoria.jpg)

What do you think of the result?

Until next time,

Orion
