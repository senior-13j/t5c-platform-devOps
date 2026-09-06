# Arkadii Quest Game Quality Audit

Baseline audit: 2026-07-23

Documentation/rebrand review: 2026-09-06

## Outcome

The July baseline covered the English/Russian entry flow, translated active
game content, desktop/touch gameplay, responsive HUD/panels, accessibility
semantics, server movement validation, Colyseus room startup, and real WebGL
behavior. Automated and manual browser checks used `1440x900`, `412x915`, and
short-landscape `915x412` viewports.

The current Arkadii Quest release changes visible branding, introduces original
brand artwork, renames the world to Arkadia (`Аркадия`), adds localized
onboarding with an `F1` controls table, and replaces player-steered camera input
with an automatic follow camera. The post-rebrand verification completed on
2026-09-06: all 46 Node tests, localization and web-quality checks, TypeScript,
client/server production builds, Compose validation, and the applicable desktop
and touch Chromium gameplay scenarios passed. The two E2E cases that do not
belong to their current Playwright device project were intentionally skipped.

The following Lighthouse measurements belong to the immediately preceding web
quality audit and remain the latest production-profile baseline. The
localization/control branch preserved the audited semantic/SEO surface and
expanded bilingual metadata checks, but did not rerun Lighthouse. The new
Arkadii Quest artwork can also affect transfer size and paint timing, so the
scores are not presented as current production results.

| Metric | Original Baseline | Latest Measured Result |
| --- | ---: | ---: |
| Lighthouse Performance | 67 | 80 |
| Lighthouse Accessibility | 73 | 100 |
| Lighthouse Best Practices | 96 | 100 |
| Lighthouse SEO | 90 | 100 |
| First Contentful Paint | 1.8 s | 0.8 s |
| Largest Contentful Paint | 15.9 s | 5.2 s |
| Total Blocking Time | 310 ms | 90 ms |
| Cumulative Layout Shift | 0 | 0 |
| Initial game resources | 101 | 88-89 |
| Real WebGL loading time | about 8.7 s | about 3.4 s |

The latest recorded production JavaScript entrypoint was about 2.7 MiB and the
initial game transfer about 17.8 MiB. Re-measure after the brand-asset build;
route-based asset streaming remains a separate performance project.

## Previously Verified Foundation

- Added an accessible pre-engine dialog for English/Russian and
  keyboard/mouse/touch selection with device-aware defaults and persisted
  preselection.
- Localized active UI, metadata, accessibility text, abilities, items, races,
  quest content, locations, help, NPC/enemy names, dialogs/actions, tooltips,
  chat labels, and supported server notifications.
- Added camera-relative WASD/arrow movement, `1`-`9` hotbar actions, panel
  hotkeys, nearest interaction/target selection, chat focus, panel dismissal,
  and screenshot access.
- Added an analog virtual joystick, interaction, nearest-target, chat, menu,
  and tappable hotbar controls for phones and tablets.
- Reworked portrait and short-landscape HUD geometry and touch panel behavior;
  touch actions are approximately 44 CSS px or larger.
- Added typed translation contracts, source-data/dialog coverage checks, HTML
  binding checks, and desktop/touch real WebGL Playwright projects.
- Hardened movement on both sides of the network by normalizing vectors,
  rejecting non-finite components, stopping near-zero input, and blocking
  movement for dead/blocked players.
- Preserved the prior canonical, Open Graph/Twitter, `VideoGame` JSON-LD,
  manifest, crawler, answer-engine, reduced-motion, and failure-state work.

The baseline also tested mouse/touch camera gestures. Those gestures are
superseded by the automatic follow-camera design and must not be treated as
current requirements.

## Current Release Acceptance Criteria

- Every player-facing entry, loader, login, menu, help, watermark, manifest,
  social, and discovery surface uses `Arkadii Quest` in English and
  `Аркадия Квест` in Russian.
- Player-facing lore names the world `Arkadia` / `Аркадия`; legacy internal
  location or database keys may remain stable when changing them would require
  a data migration.
- A first-entry onboarding guide explains movement, interaction, targeting,
  hotbar actions, chat, and panels in the selected language.
- `F1` on desktop and the touch guide button reliably reopen the controls
  table; `Escape` closes it without leaving movement or touch HUD state stuck.
- The camera follows the active character automatically. Wheel, right-/middle
  drag, and touch world-swipe do not rotate or zoom the gameplay camera.
- Desktop, phone portrait, and short-landscape layouts keep the guide and HUD
  inside the viewport with visible focus and practical touch targets.
- The local logo, key art, icons, favicon, and social image load without stale
  references to retired artwork.
- A clean production build passes localization, metadata/reference, type,
  WebGL desktop/touch, and server checks before public deployment.

## Bugs Fixed

| Area | Defect | Resolution |
| --- | --- | --- |
| Chat | Babylon `InputText` was treated like a DOM field with unsupported focus/blur assumptions | Chat now uses `AdvancedDynamicTexture.focusedControl` for focus, blur, and focus detection |
| Chat hotkey | The same `Enter` event could focus and immediately blur chat | Focus is deferred to the next event-loop turn and movement is suspended first |
| Version text | Configuration included the word `Version`, while the localized label added it again | Configuration now stores only `0.5.0` |
| Movement speed | Diagonal and oversized vectors could move faster | Client vectors are normalized and the server independently clamps magnitude to one |
| Invalid movement | Modified clients could submit missing, `NaN`, or infinite movement components | The server converts invalid components to zero and ignores near-zero input |
| Stuck movement | Held keys or joystick input could survive focus loss, page hiding, chat opening, or scene disposal | Lifecycle handlers clear key state, analog state, and player movement |
| Opposing keys | Contradictory direction keys could leave inconsistent movement state | Direction is recomputed from the complete pressed-key set on every key transition |
| Room startup | `GameRoomState.init()` ran asynchronously from its constructor and could race joins/updates | `GameRoom.onCreate()` now awaits initialization before publishing state and starting handlers/simulation |
| Room leave | Cleanup assumed state, auth, and database were always initialized | Leave cleanup guards each dependency and awaits the online-status update only for a valid character |
| Mobile GUI scale | CSS viewport values were applied directly to Babylon render pixels, producing roughly scale-factor overflow | Responsive controls convert CSS dimensions through the GUI texture/render-canvas scale |
| Russian character panel | Longer translated labels collided with values and equipment | Statistic rows were reflowed and the equipment grid is clamped to actual panel width |
| Touch panel layering | Panels opened over hotbar, status bars, chat, hints, and DOM controls | Full touch panels temporarily hide all underlying gameplay HUD layers until close |
| Entity localization | Moving entities could revert to server-language names after a network patch | Localized spawn names are reapplied after every relevant state update |
| Touch tooltip | A tap could leave a hover tooltip covering gameplay | Hover-only hotbar tooltips are disabled in touch mode |
| Control hint | The hint overlapped status/menu UI, especially in short landscape | Hint placement was revised and the hint is hidden on narrow short-landscape layouts |
| Touch targets | Compact menu, panel, chat, inventory, and dialog controls were too small | Critical actions now resolve to practical 44 px-class targets |
| Observer cleanup | Input observers and window/canvas listeners could outlive a scene | Scene disposal removes listeners, clears the hint timer, and resets movement |

## Visual and Functional Matrix

| Surface | Viewport/Profile | Result |
| --- | --- | --- |
| Preference dialog | 1440x900, English keyboard/mouse | Pass |
| Preference dialog | 412x915, Russian touch | Pass |
| Connected world/HUD | 1440x900, keyboard/mouse | Pass |
| Character panel and equipment | 412x915, Russian touch portrait | Pass |
| Connected world/HUD | 915x412, Russian touch landscape | Pass |
| Character panel/HUD separation | 915x412, Russian touch landscape | Pass |
| Real movement | WASD and native touch joystick events | Pass |
| Automatic camera | Follow/look-ahead on desktop and touch; wheel and drag leave it unchanged | Pass |
| Menus, hotbar, target, chat | Both profiles | Pass |

The current desktop run verified real WASD displacement and the touch run
verified native joystick displacement. The touch portrait panel remained inside
the 412x915 viewport; the short-landscape panel remained inside 915x412 with the
gameplay HUD hidden. Target names stayed Russian after later network patches,
and the run also exercised onboarding, tutorial progress, `F1`, panel hotkeys,
interaction, targeting, chat focus, and automatic-camera invariants.

## Localization Review

The Russian copy was reviewed in context rather than generated by mechanically
replacing isolated words. Terminology is consistent across controls, help,
dialogs, inventory, equipment, quests, abilities, and notifications. Placeholder
parity is enforced automatically, including values such as names, levels,
amounts, costs, and cooldowns.

The validation script also compares localization keys against every active
server data key and verifies dialog/button counts. This prevents a newly added
ability, item, race, quest, location spawn, or interactive dialog from silently
shipping without corresponding localized content.

## Accessibility Notes

The new entry surface uses a labelled/described modal dialog, native radio
controls, visible focus, localized ARIA names, and touch-sized actions. The
document language and control instructions update with the selected choices.
The existing skip link, landmarks, live regions, progress state, retry flow,
reduced motion, and semantic discovery content remain present.

Babylon GUI and 3D gameplay remain primarily visual. Full screen-reader parity
for inventory, combat, and character management requires a native DOM command
layer or equivalent accessible controls and is not claimed by this audit.

## SEO and AEO

- Canonical, description, Open Graph, Twitter, manifest, crawler, sitemap, and
  `llms.txt` surfaces must consistently identify Arkadii Quest.
- The `VideoGame` JSON-LD now declares both `en` and `ru` in `inLanguage`.
- Runtime title/description/social metadata follows the selected language.
- `llms.txt` and served docs should link to the localization/control reference.
- `check:web-quality` now asserts the preference dialog and bilingual structured
  data in addition to the existing semantic/discovery checks.

## Asset Review

The Arkadii Quest brand mark and wordmark SVGs were created in this repository.
The key art was generated specifically for this rebrand with OpenAI image
generation and no input reference image; social art, PNG icons, and the favicon
are project-created derivatives. These replace the retired public logo and
external README screenshots.

The broader legacy game asset library is not yet cleared as a whole. The goblin
source has an explicit CC BY-SA 4.0 record and the construction-only Breathe
Fire III font is recorded as freeware/non-commercial. The runtime font and most
models, textures, sounds, icons, portraits, and editable source files do not
have complete source/author/license records in the repository. Treat those gaps
as release blockers for commercial distribution. The authoritative working
ledger and required actions are in the root `THIRD_PARTY_ASSETS.md` file.

## Dependency Review

On 6 September 2026, the full dependency tree reported 2 low, 11 moderate, 1
high, and 0 critical findings. The production tree reported 2 low, 9 moderate,
1 high, and 0 critical findings. The high finding is the nested legacy
`nanoid@2.1.11` used by `@colyseus/core@0.15.57`; npm offers only a breaking
Colyseus/core 0.18 upgrade for that chain. Current game-generated IDs use the
patched top-level `nanoid@3.3.18`, but the transitive advisory remains real and
requires a tested Colyseus protocol migration. Safe non-breaking audit updates
were applied; no forced major upgrade was used. Run a current audit before
deployment because advisory data changes over time.

## Reproduce

```bash
npm run check:localization
npm run check:web-quality
npx tsc --noEmit
npm run client-build
npm run server-build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
docker compose --env-file .env.public.example -f docker-compose.public.yml config --quiet
npm audit --omit=dev
```

When `/usr/bin/chromium` is not available, run `npx playwright install chromium`
once and then use `npm run test:e2e` without the executable-path override.
After the automated run, manually verify both languages, onboarding/`F1`,
automatic camera behavior, the new key art/logo/icon set, and the deployed
social preview at `https://arkadii.world/game/`.
