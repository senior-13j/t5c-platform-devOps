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
| Project-created | Created specifically for Arkadii Quest; no third-party input asset is known |
| Attributed / conditional | A source and license are recorded, but attribution or share-alike obligations apply |
| Restricted | The available record limits use; do not ship outside those terms |
| Verification required | Source, author, license, or derivative chain is incomplete |

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

## Assets with an Existing Source Record

### Goblin model source

- Files: `construction/Models/Characters/goblin/**`
- Title: “Goblin”
- Author: [moppius](https://sketchfab.com/moppius)
- Source: [Sketchfab model page](https://sketchfab.com/3d-models/goblin-9bf39d5a9fd849c79a6d33870d765840)
- License recorded in the repository:
  [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/)
- Local evidence: `construction/Models/Characters/goblin/license.txt`
- Status: **attributed / conditional**.

Redistribution must preserve attribution, a link to the license, and an
indication of modifications. Adapted material must be distributed under the
same or a compatible license as required by CC BY-SA 4.0. Before release, trace
whether any exported runtime model or texture is derived from this source and
apply the same record to that output.

### Breathe Fire III font

- File: `construction/Fonts/BreatheFireIii-PKLOB.ttf`
- Source recorded locally:
  <https://www.fontspace.com/breathe-fire-iii-font-f69367>
- Local evidence: `construction/Fonts/info.txt`
- Recorded terms: “Freeware, Non-Commercial.”
- Status: **restricted**.

Do not use this file in a commercial build or commercial source distribution
without separately documented permission. It is not the font currently loaded
by `public/styles.css`, but it still needs a redistribution review because it is
present in the repository.

### KayKit Adventurer Character Pack reference

- Reference: [KayKit Adventurers](https://kaylousberg.itch.io/kaykit-adventurers)
- Local evidence: the credit in `construction/README.md`.
- Exact source files/exports, downloaded version, license text, and modification
  chain: not recorded locally.
- Status: **verification required**.

Do not infer the license from memory or from the current store page alone.
Archive the license that applied to the downloaded version, then map every
derived Blender, GLB, texture, portrait, and animation output to it.

## Known Provenance Gaps

The following groups are present but do not have a complete local
source/author/license/derivative record. They require verification or
replacement before commercial distribution.

| Group | Representative paths | Known issue / required action |
| --- | --- | --- |
| Retired source marketing | `construction/Marketing/**`, `construction/Retrospective*`, `construction/map_eldoria.jpg` | These contain the retired upstream identity and, in some cases, screenshots or links. They are not shipped by the public build; retain only as historical source material with applicable rights documented. |
| UI, cursor, icon, and portrait images | `public/images/cursor/**`, `public/images/icons/**`, `public/images/portrait/**`, `public/images/ui/**`, related `construction/*.afdesign` sources | No complete per-file source and license mapping was found. Identify original/project-created work versus pack-derived or downloaded material. |
| World, character, item, and navmesh models | `public/models/**`, `construction/Models/**` except the separately recorded goblin source | Editable-to-runtime derivative chains and licenses are incomplete. Record the source pack/file, author, version, license, modifications, and exported GLB/navmesh for each family. |
| Materials, effects, terrain, water, and skybox textures | `public/models/materials/**`, `public/textures/**`, `construction/Textures/**` | Most files have no embedded or adjacent license record. Filenames such as `seamless_desert_sand_texture_by_hhh316_d311qn7-fullview.jpg`, `0088-green-grass-texture-seamless-hr.jpg`, and `Tileable classic water texture.jpg` suggest external origins but are not adequate attribution. Locate the original pages/licenses or replace the files. |
| Music and sound effects | `public/sounds/**`, `construction/Sounds/**` | No complete author/source/license ledger was found. Fingerprint duplicates, identify sources, and replace or document every shipped track/effect. |
| Editable Affinity/Blender sources | `construction/**/*.afdesign`, `construction/**/*.afphoto`, `construction/**/*.blend*`, `construction/Models/Animations/*.fbx` | An editable file can embed third-party textures, fonts, meshes, or screenshots. Review linked/embedded resources and export lineage; the editable format is not evidence of ownership. |
| Vendored browser libraries | `public/lib/pep.js`, `public/lib/draco_*` | These are third-party software rather than game art. `pep.js` carries an upstream notice; the Draco copies need exact version/source/license mapping. Preserve headers and ship all required license notices. |

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

## Commercial-Release Gate

Before calling an Arkadii Quest asset bundle commercially cleared:

1. Build from a clean checkout and inventory the actual contents of
   `dist/client`; unused files copied from `public/` still count as distributed.
2. Replace or obtain permission for the runtime font and every unresolved
   texture, model, sound, icon, portrait, and background that remains in that
   inventory.
3. Trace any KayKit-derived exports to an archived license for the downloaded
   version.
4. Preserve the goblin attribution and CC BY-SA obligations for every derivative
   that is distributed.
5. Remove restricted construction-only files from any commercial source bundle
   unless their redistribution terms and permission are documented.
6. Preserve license headers/notices for vendored browser libraries and produce
   a dependency-license report for the production package tree.
7. Re-run this audit whenever an asset is added, regenerated, replaced, or
   exported from an editable source.

Until these items are complete, the ledger is a transparent record of known
facts and gaps, not a blanket clearance opinion.

## Removed from the Public Build

The 2026-09-06 rebrand removed the unlicensed runtime font
`public/fonts/font.ttf`, the unverified `background_mainmenu_1.jpg`, and the
retired `logo.png` / `logo_SQUARE.jpg` files. They are replaced by system font
stacks and the project-created Arkadii Quest assets recorded above, so clean
production builds no longer redistribute those four files.
