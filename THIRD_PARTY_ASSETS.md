# Third-Party Assets and Provenance Ledger

Last reviewed: 2026-09-06

This is the working provenance record for visual, audio, font, model, and
vendored runtime assets in Arkadii Quest. It covers both the public game bundle
and editable files under `construction/`, because redistributing the repository
can redistribute assets that are not loaded by the game.

An asset's presence in the repository is not proof of unrestricted ownership or
commercial permission. The repository's MIT software license does not override
a third party's asset license. Where evidence is incomplete, this document uses
the conservative status **verification required**.

## Status Key

| Status | Meaning |
| --- | --- |
| Confirmed permissive | The source and a license allowing commercial use and redistribution were matched to the shipped file or a documented derivative chain |
| Project-created | Created specifically for Arkadii Quest; no third-party input asset is known |
| Attributed / conditional | Commercial use is allowed only while recorded attribution or other conditions are met |
| Restricted | The available record limits the intended use, or commercial permission depends on proof that is not present |
| Verification required | Source, author, license, or derivative chain is incomplete |

## What the Client Build Actually Ships

`webpack.common.js` copies all of `public/` into `dist/client` and all of
`docs/` into `dist/client/docs/content`. There is no used-asset filter. The
post-cleanup production output contains every one of the 110 paths under
`public/`. The removed-unused-assets audit is recorded below. Webpack may
minimize copied JavaScript, but every remaining public path still enters the
distribution.

The rebuilt `dist/client` contains 225 files and 13,123,061 bytes (12.52 MiB):

| Output group | Files | Bytes | MiB |
| --- | ---: | ---: | ---: |
| `models/` | 42 | 6,616,904 | 6.31 |
| `sounds/` | 6 | 800,226 | 0.76 |
| `textures/` | 13 | 354,658 | 0.34 |
| `images/` | 34 | 518,804 | 0.49 |
| `lib/` | 5 | 705,268 | 0.67 |
| `js/` | 107 | 3,936,278 | 3.75 |
| copied documentation | 10 | 108,543 | 0.10 |
| favicon and other web shell files | 8 | 82,380 | 0.08 |

The fifth `lib/` output is `lib/pep.js.LICENSE.txt`, generated during
minification. It is only a preserved header, not the complete MIT text. The
JavaScript bundles likewise need a generated production dependency notice; a
local `license-checker --production` audit found 206 MIT, 11 Apache-2.0, seven
BSD-2-Clause, five ISC, four BSD-3-Clause, one 0BSD, and one CC-BY-4.0 package
(`caniuse-lite`). This summary covers the installed production tree, not a
file-by-file proof of which packages Webpack emitted.

## Arkadii Quest Brand Assets

| Asset | Provenance | Status and action |
| --- | --- | --- |
| `public/images/arkadii-quest-logo.svg` | Wordmark and compass-shield composition created in this repository for the 2026 rebrand | Project-created; preserve the repository history as the source record |
| `public/images/arkadii-quest-mark.svg` | Compass-shield mark created in this repository for the 2026 rebrand | Project-created; preserve the repository history as the source record |
| `public/images/arkadii-quest-keyart.webp` | Generated specifically for this rebrand with OpenAI image generation; no input reference image was supplied | Project-created for this release; retain prompt/tool/date provenance in project records when practical |
| `public/images/arkadii-quest-social.webp` | Social-card derivative created for Arkadii Quest from the new visual direction | Project-created derivative |
| `public/images/arkadii-quest-icon-192.png`, `public/images/arkadii-quest-icon-512.png`, `public/favicon.ico` | Raster/application-icon derivatives of the new Arkadii Quest mark | Project-created derivatives |

These records cover asset provenance, not trademark policy. Arkadii Quest is not
affiliated with RuneScape or Jagex, and its assets must not be altered to copy
their wordmarks, logos, interface, icons, or other distinctive material.

## Confirmed Permissive Third-Party Families

### KayKit character, item, and dungeon sources

The following official source records were checked and pinned during this
audit:

| Source family | Frozen source | Recorded license |
| --- | --- | --- |
| KayKit Adventurers Character Pack 1.0 | [official license at commit `672074b`](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Adventures-1.0/blob/672074b73ba276876a19e8816ecdc5241817ab47/LICENSE.txt) | CC0 1.0; personal, educational, and commercial use; credit optional |
| KayKit Character Pack Skeletons 1.0 | [official license at commit `15b62b9`](https://github.com/KayKit-Game-Assets/KayKit-Character-Pack-Skeletons-1.0/blob/15b62b9bad122f72926c10fb14d622c73819fa54/LICENSE.txt) | CC0 1.0; personal, educational, and commercial use; credit optional |
| KayKit Dungeon Remastered 1.0 | [official license at commit `b0ca9bd`](https://github.com/KayKit-Game-Assets/KayKit-Dungeon-Remastered-1.0/blob/b0ca9bd96a8072ab36a3a5464f00ed1e06a16d07/LICENSE.txt) | CC0 1.0; personal, educational, and commercial use; credit optional |
| KayKit Mystery Monthly Series 4, including the April 2024 Paladin | [official pack page](https://kaylousberg.itch.io/kaykit-series-4) | CC0 1.0; personal and commercial use; credit optional |
| KayKit Character Animations | [official pack page](https://kaylousberg.itch.io/kaykit-character-animations) and [legacy 1.2 page](https://kaylousberg.itch.io/kaykit-animations) | CC0 1.0; personal and commercial use; credit optional |

Local evidence connects these sources to the following shipped files:

- `construction/README.md` credits KayKit Adventurers. Multiple Blender files
  contain exact paths under `KayKit_Adventurers_1.0_SOURCE`, including the
  knight, mage, druid, and engineer atlases.
- The four public base atlases are byte-identical to the frozen Adventurers 1.0
  files:
  `barbarian_texture.png` =
  `7329b2ff9709e8d54c886d5ef49c08bd42b12be3bbb2facb1488a6b48b1e8a80`,
  `knight_texture.png` =
  `5d250ccc5da020e6126bfa3839f83bd9a465a951ed223e4d13c08b1925e154d4`,
  `mage_texture.png` =
  `ea49f094b960402635fe51db9f1864960c97271b17f2e3554e5aca1b2bbba144`,
  and `rogue_texture.png` =
  `a4032e877c3b91939f5cdbb630349c1998fdbc3211bbd587c111125500fe4cc5`.
- The official Adventurers page expressly places the EXTRA alternative
  textures and SOURCE files under the same CC0 asset license. The local druid,
  engineer, and alternative texture names and Blender paths match those tiers.
  Therefore the 24 Adventurers files in `public/models/materials/` are
  **confirmed permissive**.
- `public/models/materials/skeleton_texture.png` is byte-identical to the
  official Skeletons 1.0 texture, SHA-256
  `15741a25c53e04fa9bf3beac3bc0de442359404b1ff9be863b892cb551ad3657`.
  `public/models/races/skeleton_01.glb` embeds that atlas and names the meshes
  `Skeleton_Rogue_*`. This model family is **confirmed permissive**.
- `construction/Models/Characters/humanoid_01.blend` and `_02.blend` contain
  Adventurers paths and `PrototypePete_*` meshes. They also identify
  `MCOTMC - Series 4/10 - April 2024 - Paladin`, `Paladin_Head`, and
  `Paladin_Cape`. The Series 4 page lists the Paladin and applies CC0 to the
  pack. `public/models/races/humanoid.glb` contains the corresponding meshes
  and KayKit animation names. Its identified third-party inputs are
  **confirmed permissive**.
- The Blender sources and embedded atlas names connect
  `armor_01.glb`, `hat_01.glb`, `helm_01.glb`,
  `potion_small_blue.glb`, `potion_small_red.glb`, and `sword_01.glb` to
  Adventurers. Their identified third-party inputs are **confirmed
  permissive**. The removed `cape_01.glb` was connected to the Series 4
  Paladin. The separate geometry source for `amulet_01.glb` and `shield_01.glb`
  is not recorded, so those two remain verification required even though the
  shield embeds a KayKit atlas.
- `public/models/environment/lh_dungeon_01.glb` uses official Dungeon
  Remastered mesh names such as `chest_gold`, `barrel_large`, `pillar`,
  `floor_tile_large`, `wall_corner`, `wall_cracked`, and `stairs_wide`; its
  embedded atlas is a downsample of the official dungeon atlas. The pack input
  is confirmed CC0. The locally assembled level and its navmesh retain the
  historical-license ambiguity documented below.

These records establish the license of the named third-party inputs. They do
not establish that every current model contains only those inputs, and they do
not cover `lh_town.glb`, `training_ground.glb`, the retired rat source under
`construction/`, the amulet, or the shield geometry.

### Vendored browser libraries

| Shipped files | Match and license | Status and action |
| --- | --- | --- |
| `public/lib/pep.js` | SHA-256 `f037bfd25989964aad31b7007516499849c4e9ab42da6bf736f0f6247f8615f4`, byte-identical to `pepjs@0.5.3` even though its retained banner says v0.5.1; [jQuery/OpenJS license](https://jquery.com/license/) is MIT | Confirmed permissive; preserve the header and ship the complete MIT text |
| `public/lib/draco_decoder_gltf.js`, `draco_decoder_gltf.wasm`, `draco_wasm_wrapper_gltf.js` | Byte-identical to Google's versioned Draco 1.5.7 CDN files; [Draco is Apache-2.0](https://github.com/google/draco/blob/1.5.7/LICENSE) | Confirmed permissive; ship the Apache-2.0 license and relevant notice |

The three retained Draco hashes, in the same order as the table, are
`ea66fdedab5c974050c67aaa86d795cecf9c70aa53b0ddb318b1979f1e1c5be1`,
`712db3449ae2041d6e8a224c395bda6cedb49e51322fae38b7db9beb8b381889`,
and `8bb2952d2ba7d67e1414f8df819410cb0434a666be53f671fff75f68843d76f6`.
The un-suffixed `draco_decoder.wasm` (SHA-256
`2516a4e43526d71787bf2f678f951329f7f858f8f15f42d4bc9e370b31a0da3a`)
was removed after confirming the current decoder configuration does not
reference it. The current build does not ship the full PEP MIT or Draco Apache
license text.

## Conditional and Restricted Source Records

### Goblin model source

- Files: `construction/Models/Characters/goblin/**`
- Title: “Goblin”
- Author: [moppius](https://sketchfab.com/moppius)
- Source: [Sketchfab model page](https://sketchfab.com/3d-models/goblin-9bf39d5a9fd849c79a6d33870d765840)
- License recorded in the repository:
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- Local evidence: `construction/Models/Characters/goblin/license.txt`
- Status: **attributed / conditional**.

This source is not copied into `dist/client`. A source-code distribution must
preserve attribution, the license link, an indication of modifications, and
the applicable share-alike terms. No current runtime GLB was positively matched
to this source.

### Breathe Fire III font

- Removed files: `construction/Fonts/BreatheFireIii-PKLOB.ttf` and its sole
  provenance companion, `construction/Fonts/info.txt`
- Source that was recorded locally:
  <https://www.fontspace.com/breathe-fire-iii-font-f69367>
- Recorded terms: “Freeware, Non-Commercial.”
- Status: **restricted asset removed on 2026-09-06**.

Repository-wide reference checks found no use of the font, its filename, its
FontSpace record, or `construction/Fonts/`. `public/styles.css` uses system font
stacks, and Webpack never copied `construction/` into the client. Removing the
47,864-byte TTF and 97-byte `info.txt` prevents future source archives from
redistributing them. Their respective SHA-256 values were
`c8c79f886f65211a971a259dfe55751e96ad4beaf59132de3598416cd8a337fe`
and `4c49ca042f5d3f4c859ba2814e41b2cf68cc31427e05dc25337818a90a867adf`.
Their blobs remain in Git history unless a separately coordinated history
rewrite is performed.

### Music and sound-effect records

| Asset | Runtime state | Evidence | Status and smallest safe action |
| --- | --- | --- | --- |
| `sounds/music.mp3` | Removed on 2026-09-06 after confirming no source reference | Embedded title “Elven Forest” and FesliyanStudios metadata; the [official track page](https://www.fesliyanstudios.com/royalty-free-music/download/elven-forest/376) identifies David Renda. The [current policy](https://www.fesliyanstudios.com/policy) requires a donation/license for commercial use. No receipt or license is in the repository | **Restricted asset resolved by removal** |
| `sounds/music_02.mp3` | Removed on 2026-09-06 after confirming that playback was disabled and no live consumer remained | Embedded title `Our Mountain_v003_Looping`, author Eric Matyas, copyright 2018; [official source record](https://soundimage.org/fantasywonder/our-mountain/) | **Conditional asset resolved by removal**; restore only with the applicable license and visible credit |
| `sounds/fire_attack_2.wav` | Removed on 2026-09-06 after confirming no source reference | Embedded Brian Fairbanks / Epic Stock Media / Fantasy Game metadata | **Restricted asset resolved by removal** |
| `sounds/hit_a.wav`, `player_walking.wav` | Preloaded and played | Same embedded Brian Fairbanks / Epic Stock Media / Fantasy Game metadata. The [official product](https://epicstockmedia.com/product/fantasy-game/) is sold under a single-user license, and the [EULA](https://epicstockmedia.com/licensing-agreement/) says the license is validated by proof of purchase | **Restricted pending proof**; archive the applicable receipt/EULA and confirm public-web delivery satisfies it, or replace the sounds |
| `sounds/hit_b.wav` | Removed on 2026-09-06 after confirming that its preload entry had no playback consumer | Same embedded Brian Fairbanks / Epic Stock Media / Fantasy Game metadata | **Restricted asset resolved by removal** |
| `sounds/dialog_open.wav` | Preloaded and played | Embedded title `TURN PAGE 01`, author Mattias Michael Lahoud, date 2017; no exact source/license match | **Verification required**; locate the original item and license or replace it |
| `sounds/dialog_close.wav`, `fire_attack_1.wav`, `heal_1.wav` | Preloaded and played | No meaningful embedded or adjacent provenance | **Verification required**; replace or document each file |
| `sounds/footsteps.wav` | Removed on 2026-09-06 after confirming no source reference | Logic Pro/date metadata only | **Unverified asset resolved by removal** |

The Soundimage license also prohibits obscene or pornographic use. That
restriction makes it conditional rather than an open-content license even when
the required credit is present.

## Historical Model Restriction

Repository history contains a direct warning that cannot be ignored. Commit
`1ee75f2f79678a1b22531548a5b543a25cf5d104` dated 2023-02-06 added this README
statement:

> All models under the ./public/models folder does not fall under the GNU
> license and cannot be used commercially.

Commit `a0e220853aec6286a731037f0176d59182735bcb` removed that statement and the
old GPL file on 2023-09-27. Commit
`572d58ebb8a2c282ce031e8c23287f38171538ae` added the MIT software license four
minutes later. That sequence does not, by itself, prove that every third-party
model was relicensed or that the upstream author owned every right needed to do
so.

At the time the restriction was removed, the model tree already included the
town, dungeon, their navmeshes, the amulet, helm, potions, shield, sword,
`male_knight`, `male_mage`, `male_rogue`, and several material atlases. Some
current binaries were subsequently re-exported, but their complete derivative
chains were not recorded. For commercial release, obtain written clarification
for any retained pre-existing creative contribution or rebuild it from the
confirmed CC0 source packs. The three old `male_*` GLBs and their VAT JSON were
removed on 2026-09-06 after the executable-data audit confirmed that the active
race registry generates no URL for them.

## Shipped Assets Still Requiring Verification or Replacement

### World and model files

| Asset | Evidence | Status and action |
| --- | --- | --- |
| `public/models/environment/lh_town.glb` and `public/models/navmesh/lh_town.glb` | The environment was generated with UnityGLTF and embeds 15 textures with identifiers such as `360_F_249760944_...`, `Medieval_Texture`, `alexander-puhov-2018-09-22-14-32-31`, `T_ENV_MOD_Wall_01_v3_*`, and `brown-soil-texture-background_172107-1582`. Mesh names include `SF_Prop_Grave_01`, `SF_Env_Tree_05`, `SF_Bld_HouseAdd_Sign_Tavern_01`, and `MOD_Wall_01_*`. No source-pack licenses, receipts, or per-texture records exist locally | **Verification required and a commercial blocker**. Replacing the town with an owned/CC0 world and regenerating its navmesh is more practical than clearing each embedded source |
| `public/models/environment/training_ground.glb` and its navmesh | UnityGLTF output with one embedded gray-grid JPEG named `ddbfee8d87b55e3f1ac9372a7f74e0f4`; no source record | **Verification required**; recreate the simple plane/texture and regenerate the navmesh |
| `public/models/items/amulet_01.glb`, `shield_01.glb` | No exact geometry-source record; the shield's KayKit texture does not establish the mesh license | **Verification required**; document or replace the geometry |
| `public/models/environment/lh_dungeon_01.glb` and its navmesh | KayKit Dungeon Remastered input is confirmed CC0, but the assembled output has a pre-MIT history covered by the former non-commercial model warning | **Verification required for the local contribution**; obtain clarification or rebuild the layout/navmesh from the pinned CC0 pack |

The former dungeon rat spawn now uses the registered CC0 `skeleton_01` race.
`public/models/races/rat_01.glb` and `public/models/races/vat/rat.json` were
therefore removed after confirming that neither the active race registry nor
any location generates their URLs. The unmatched `construction/Models/Characters/rat_01.blend*`
source remains outside the client build and should be excluded or cleared before
publishing a commercial source archive.

### Runtime textures and public images

- Runtime code loads `circle_02.png`, `decal_target.png`, `particle_01.png`,
  `selected_circle_green.png`, `shadow_01.png`, `slash_01.png`,
  `waterbump.jpg`, and the six `skybox_*.jpg` faces. Only `shadow_01.png` has a
  matching editable source (`construction/Textures/shadow_01.afphoto`) and a
  creation commit. The other live files have no complete source/license record
  and remain **verification required**. XMP showing an Affinity edit is not
  proof of the original input's license.
- `waterbump.jpg` was byte-identical to the now-removed duplicate
  `Tileable classic water texture.jpg` (SHA-256
  `181ee77b45290c3577fdbef7e90b865676e3e9bde9b43f4163aea8afcac8065a`).
  The duplicate was removed on 2026-09-06. The web-style filename was not a
  license, so the live `waterbump.jpg` still needs replacement or source proof.
- The five cursor PNGs, five current ability icons, and ten item icons have
  editable Affinity sources and commit histories in
  `construction/Cursor.afdesign`, `construction/Icons/Abilities-Icons.afdesign`,
  and `construction/Icons/Items-Icons.afdesign`. Commit `bfae2cf6` specifically
  replaced earlier ability icons because they were not open source. These are
  classified **project-created / pack-derived**, subject to the model license
  inherited by any rendered item silhouette.
- The five `ICON_MENU_*` images, `icons/talk.png`, and
  `ui/gear-solid.png` have no per-file source/license record and are
  **verification required**. Replace them with project-created SVG/CSS icons or
  document their exact icon-library licenses and notices.
- `ICON_RACE_male_knight.png` is a render and inherits the humanoid model's
  status. `ICON_RACE_skeleton_01.png` was replaced on 2026-09-06 by a 100x100
  image generated specifically for Arkadii Quest with OpenAI image generation.
  The erroneous bear portrait was supplied only as a reference for square
  framing and low-poly rendering style; the subject was replaced completely.
  The retained generation brief was: an original low-poly undead skeleton
  adventurer portrait with an ivory skull, dark-iron shoulder armour, burgundy
  collar, amber eyes, and a dark-brown background, composed as a square and
  readable at 64px. The generator returned a 1254x1254 RGB PNG with SHA-256
  `661a4ecf8a20d97d4cee133052c6f59570f1e0d401020beaf008ada131ac0047`;
  it was reduced to 100x100 with ImageMagick's default resize filter (the
  resized pixels reproduce exactly with `-resize 100x100`).
  It is recorded as **project-created AI-generated**,
  SHA-256
  `d622790df1e487f67f7c085d017b587af34ee1f10da69bdcc8a458fbb0945757`.
  The prior bear duplicate and the unused `ICON_RACE_monster_bear.png` were
  removed from the current build.

## Removed Unused Public Files (2026-09-06)

A repeated audit confirmed that 38 public files had no current executable use.
The check searched exact basenames and asset stems throughout the repository,
excluding generated `dist/` output and this ledger, and separately generated
the runtime URL set from the active `RacesDB`, `ItemsDB`, `AbilitiesDB`,
`LocationsDB`, and the hard-coded preload list. The candidate intersection with
that active set was empty. The remaining `male_knight` text occurrences are the
live humanoid portrait name and a server schema default; they do not register
or request the retired `male_knight.glb` or VAT JSON. The `male_mage`,
`male_rogue`, and `cape_01` data blocks are commented out and produce no client
asset entries. The unregistered `RaceVAT.rat` definition was removed after the
dungeon spawn changed to `skeleton_01`; no runtime or location-data path now
requests either retired rat file.

The following 38 files were deleted from `public/`, removing 19,707,001 bytes
(18.79 MiB) from every clean client build:

| Removed group | Files | Bytes | MiB |
| --- | ---: | ---: | ---: |
| textures | 16 | 3,760,628 | 3.59 |
| sounds | 5 | 3,514,260 | 3.35 |
| images | 7 | 61,877 | 0.06 |
| models | 9 | 12,084,288 | 11.52 |
| library | 1 | 285,948 | 0.27 |
| **Total** | **38** | **19,707,001** | **18.79** |

- 16 textures: `0088-green-grass-texture-seamless-hr.jpg`,
  `Tileable classic water texture.jpg`, `circle_01.png`, `dirt_01.png`,
  `flame_01.png`, `flare.png`, `ground.jpg`, `magic_01.png` through
  `magic_05.png`, `seamless_desert_sand_texture_by_hhh316_d311qn7-fullview.jpg`,
  `star_01.png`, `sprites/explosion_01.webp`, and `sprites/slash_01.jpg`.
- Five sounds: `music.mp3`, `music_02.mp3`, `fire_attack_2.wav`,
  `footsteps.wav`, and `hit_b.wav`.
- Seven images: `images/loading.svg`,
  `images/icons/ICON_ITEM_shield_01_gold.png`, and
  `images/portrait/ICON_RACE_male_adventurer.png`,
  `ICON_RACE_male_enemy.png`, `ICON_RACE_male_mage.png`,
  `ICON_RACE_male_rogue.png`, and `ICON_RACE_monster_bear.png` in the same
  portrait directory.
- Nine model files: `models/items/cape_01.glb`,
  `models/races/male_knight.glb`, `male_mage.glb`, and `male_rogue.glb`, plus
  `models/races/vat/male_knight.json`, `male_mage.json`, and `male_rogue.json`,
  and the retired `models/races/rat_01.glb` / `models/races/vat/rat.json` pair.
- One library file: `lib/draco_decoder.wasm`.

After the cleanup and the independently replaced skeleton portrait, `public/`
contains 110 files and 9,197,357 bytes (8.77 MiB). A clean production rebuild
contains 225 files and 13,123,061 bytes (12.52 MiB); none of the 38 removed paths
is present. This cleanup does not remove the remaining live commercial blockers
described above.

Cleanup verification on the same worktree: all 46 URLs derived from the active
game databases and hard-coded preload list still exist; direct searches for all
38 removed filenames outside `dist/` and this ledger returned zero references;
the production Webpack build, web-quality check, and 80-test suite passed.

## Required Release Record

For every asset family that remains in a distributable build or source archive,
record:

1. Runtime path and editable source path.
2. Original title, author, and canonical source URL.
3. Downloaded version/date and a copy or permalink of the applicable license.
4. Whether commercial use, modification, and redistribution are permitted.
5. Changes made and the chain from source file to exported runtime file.
6. Required credit wording, license links, share-alike/source obligations, and
   placement of those notices.
7. A content hash so later replacements cannot silently inherit an old record.

## Minimal Commercial-Release Action Set

1. **Completed 2026-09-06:** deleted the 38 unused public files above and
   rebuilt the production client. This removed the undocumented Fesliyan track,
   an undocumented Epic Stock Media effect, old model exports, web-named
   textures, the retired rat export, disabled music, and 18.79 MiB of
   unnecessary distribution.
2. Replace `lh_town.glb` with an owned or pinned permissive world and regenerate
   its navmesh. Recreate the training-ground plane/texture.
3. For the retained Epic Stock Media sounds, add the valid purchase receipt and
   applicable EULA to the private release record and confirm the delivery model
   is permitted; otherwise replace them. Replace the four unidentified live
   effects. The disabled Eric Matyas music was removed; restore it only together
   with its applicable license and visible credit.
4. Replace the remaining live unverified water, skybox, VFX, menu, talk, gear,
   and humanoid portrait images with project-created or pinned permissive
   equivalents. The erroneous bear-as-skeleton portrait is already resolved.
5. Rebuild the dungeon/navmesh from the pinned CC0 Dungeon Remastered source or
   obtain written clarification for the historical local contribution. Remove
   or replace the unresolved amulet and shield geometry if their original
   sources cannot be proved.
6. Add a distributable `licenses/` directory or credits screen containing the
   complete PEP MIT text, Draco Apache-2.0 text/notice, and the archived KayKit
   CC0 records. Generate and ship a
   production dependency notice rather than relying only on minifier headers.
7. **Breathe Fire III completed 2026-09-06:** the non-commercial font and its
   sole info file were removed after a repository-wide dependency check. Review
   the CC BY-SA goblin and Mixamo-marked construction FBXs before publishing any
   commercial source archive.

Until these actions are complete, this ledger is a transparent record of known
facts and gaps, not a blanket clearance opinion.

## Removed from the Public Build

The 2026-09-06 rebrand removed the unlicensed runtime font
`public/fonts/font.ttf`, the unverified `background_mainmenu_1.jpg`, and the
retired `logo.png` / `logo_SQUARE.jpg` files. They are replaced by system font
stacks and the project-created Arkadii Quest assets recorded above, so clean
production builds no longer redistribute those four files.
