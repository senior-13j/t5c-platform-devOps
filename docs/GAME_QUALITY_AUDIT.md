# Game Quality Audit

Audit date: 2026-07-23
Branch: `feature/localization-control-modes`

## Outcome

This pass covered the English/Russian entry flow, translated active game
content, keyboard/mouse gameplay, touch gameplay, responsive HUD/panels,
accessibility semantics, server movement validation, Colyseus room startup, and
real WebGL behavior. Automated and manual browser checks used `1440x900`,
`412x915`, and short-landscape `915x412` viewports.

The localization audit passes with 180 UI keys, 81 content pairs, 49 HTML
bindings, and 133 typed translation calls. Playwright passes the desktop and
touch projects with real player displacement and camera rotation, not only DOM
visibility assertions. No page errors, unexpected console errors, or failed
runtime requests were observed in those flows.

The following Lighthouse measurements belong to the immediately preceding web
quality audit and remain the latest production-profile baseline. This controls
branch preserved the audited semantic/SEO surface and expanded bilingual
metadata checks, but did not rerun Lighthouse, so the scores are not presented
as newly measured results.

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

The production JavaScript entrypoint remains about 2.7 MiB and initial game
transfer remains about 17.8 MiB. Route-based asset streaming is still a
separate performance project.

## Improvements Verified

- Added an accessible pre-engine dialog for English/Russian and
  keyboard/mouse/touch selection with device-aware defaults and persisted
  preselection.
- Localized active UI, metadata, accessibility text, abilities, items, races,
  quest content, locations, help, NPC/enemy names, dialogs/actions, tooltips,
  chat labels, and supported server notifications.
- Added camera-relative WASD/arrow movement, `1`-`9` hotbar actions, panel
  hotkeys, nearest interaction/target selection, chat focus, panel dismissal,
  screenshot access, and right/middle-drag camera rotation.
- Added an analog virtual joystick, world-swipe camera rotation, interaction,
  nearest-target, chat, zoom, menu, and tappable hotbar controls for phones and
  tablets.
- Reworked portrait and short-landscape HUD geometry and touch panel behavior;
  touch actions are approximately 44 CSS px or larger.
- Added typed translation contracts, source-data/dialog coverage checks, HTML
  binding checks, and desktop/touch real WebGL Playwright projects.
- Hardened movement on both sides of the network by normalizing vectors,
  rejecting non-finite components, stopping near-zero input, and blocking
  movement for dead/blocked players.
- Preserved the prior canonical, Open Graph/Twitter, `VideoGame` JSON-LD,
  manifest, crawler, answer-engine, reduced-motion, and failure-state work.

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
| Real camera input | Mouse drag and native touch swipe | Pass |
| Menus, hotbar, target, chat | Both profiles | Pass |

The desktop run verified approximately one world-unit of WASD displacement and
the touch run verified more than four world units of joystick displacement. The
touch portrait panel remained inside the 412x915 viewport; the short-landscape
panel remained inside 915x412 with the gameplay HUD hidden. Target names stayed
Russian after later network patches.

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
  `llms.txt` surfaces remain validated.
- The `VideoGame` JSON-LD now declares both `en` and `ru` in `inLanguage`.
- Runtime title/description/social metadata follows the selected language.
- `llms.txt` and served docs link to the localization/control reference.
- `check:web-quality` now asserts the preference dialog and bilingual structured
  data in addition to the existing semantic/discovery checks.

## Asset Review

No new visual, audio, font, or model assets were introduced for the control and
localization work. Native HTML/CSS, existing Babylon GUI assets, and the current
icon atlas are reused, avoiding additional transfer cost or provenance risk.

Existing provenance gaps remain: only
`construction/Models/Characters/goblin/license.txt` and
`construction/Fonts/info.txt` were found as explicit records. A complete source,
author, license, and modification ledger is still required before commercial
release.

## Dependency Review

The full dependency tree reports 2 low, 12 moderate, 0 high, and 0 critical
findings. The production tree reports 2 low, 10 moderate, 0 high, and 0 critical
findings. The production advisories remain in the Colyseus 0.15
authentication/core chain and require a tested 0.17 protocol migration. The
development tree also includes a `webpack-dev-server` advisory whose available
fix is a major-version upgrade. No forced audit fix was applied.

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
