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
with an automatic follow camera. The 2026-09-06 hardening pass also migrated the
real-time protocol to Colyseus 0.18, added exact HTTP/WebSocket origin policy,
bounded authentication/gameplay traffic, strengthened movement and gameplay
authority, completed trainer learning, capped transient loot, and made
multi-table character creation and persistence transactional. The
verification run passed all 80 Node tests, localization and web-quality checks,
TypeScript, client/server production builds, Compose validation, and the
applicable desktop and touch Chromium gameplay scenarios. The two E2E cases
that do not belong to their current Playwright device project were
intentionally skipped. A clean MySQL 8.4 container additionally verified fresh
and repeated schema migration, one-winner concurrent account insertion, and
non-destructive refusal of ambiguous legacy duplicates. The final runtime image
passed health, branded-shell, game-data, login, character creation, game-room,
chat-room, disconnect-save, and offline-status checks as UID/GID 1000.

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
- Added sequence/replay checks, navmesh-result displacement bounds, known-message
  allowlisting, shared direct/click movement budgets, and one server-owned
  horizontal step allowance per simulation tick.
- Migrated server, schema, browser SDK, callback, private-view, and matchmaking
  behavior from Colyseus 0.15 to the tested 0.18 protocol.
- Restricted HTTP CORS and browser WebSocket upgrades to an exact configurable
  origin allowlist, with safe production and local-development defaults.
- Added a password-login limiter and SQL transactions for complete character
  creation and snapshot persistence on MySQL and SQLite.
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
| Mixed movement modes | Direct input plus click/pickup/combat pursuit could spend two independent steps in one tick, and diagonal paths advanced on both axes | Direct and automated movement now share one simulation-step allowance; mode switches cancel the competing path and path steps are vector-normalized |
| Failed pickup pursuit | A rejected pickup, such as with a full inventory, could rebuild its path and retry each server tick | Every pickup click performs one transfer attempt and then clears its pursuit state |
| Invalid movement | Modified clients could submit missing, `NaN`, or infinite movement components | The server rejects malformed components and ignores near-zero input |
| Replayed/forged movement | A modified client could replay sequence values or rely on an abnormal navmesh result | The server requires a fresh safe-integer sequence and rejects horizontal displacement beyond its own requested step |
| Message flooding | Gameplay actions and movement had no per-client application budget | Known message types pass through separate global, movement, and action token buckets; Colyseus also applies room-level message ceilings |
| Ping amplification | Ping bypassed the action bucket and reflected an arbitrary payload | Ping now has its own one-per-second budget, accepts only an integer timestamp, and returns a newly constructed bounded object; inbound WebSocket frames are capped at 8 KiB |
| Browser origins | HTTP CORS was permissive and WebSocket upgrades had no matching origin check | Exact configurable production/development origins now govern both HTTP responses and browser upgrades |
| Password guessing | `/login` performed an unbounded password lookup for every request | A process-local per-IP fixed window returns `429` before lookup after 10 attempts in 10 minutes |
| Concurrent registration | MySQL lacked a username unique key, so simultaneous first logins could create ambiguous duplicate identities | Fresh and existing schemas enforce one username row; duplicate-key races recheck matching credentials, while unsafe legacy duplicates stop migration without automatic merging |
| Character-creation abuse | One token could create unlimited fully provisioned character rows | Creation is limited to five HTTP attempts per IP per 10 minutes and five durable characters per account inside a serialized transaction |
| Character-creation feedback | Rejected create requests produced an unhandled promise with no visible explanation, while the selection screen still offered creation at the account limit | Both character screens use the shared five-character limit; the action disables at the limit, duplicate submits are blocked, and `400`/`401`/`409`/`429`/server failures receive specific live EN/RU feedback |
| Entry-dialog focus | The modal preference chooser did not take or contain keyboard focus | It focuses the selected language, cycles through current tab stops, removes its listener on submit, and restores focus to the prior control or game canvas |
| Character-screen keyboard access | Selecting, starting, or creating an adventurer required pointer input | Arrow keys select with wrap-around, Enter starts the selected hero, N opens creation, Escape signs out/goes back, and the editor focuses the name field for keyboard creation |
| Partial character writes | Character creation and relation replacement could commit only a subset after an adapter error | MySQL and SQLite now serialize operations and roll back complete create/save transactions on failure |
| Skill authority | Trainer requests were disabled while unlearned hotbar skills could still resolve from global data | New heroes receive only two starter skills; trainers now validate exact offer, proximity, level, stats, and gold on the server before learning and hotbar assignment |
| Item authority | Equipment requirements and consumable cooldowns were client-side assumptions | The server checks canonical equipment requirements and enforces per-item cooldowns with inventory decrement before applying bounded health/mana effects |
| Ground-loot growth | Dropped objects never expired and had no room ceiling | Loot expires after five minutes, is capped at 128 per room, and a rejected drop leaves the inventory untouched |
| Rewardless enemies | Missing reward ranges could introduce `NaN` experience and level zero | Reward ranges and experience are validated; absent rewards are safe no-ops and experience saturates at the networked limit |
| Legacy real-time protocol | Colyseus 0.15 exposed a vulnerable transitive dependency and obsolete client callback/matchmaking APIs | The stack now uses Colyseus 0.18, proxy callbacks, server-side location matching, and `StateView` privacy |
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
source has an explicit CC BY-SA 4.0 record; the unused non-commercial Breathe
Fire III font and 38 unused public files were removed. KayKit character,
skeleton, animation, and dungeon inputs have pinned permissive records, while
the current town/training world outputs, local dungeon contribution, selected
models, live sounds, UI icons, and textures still have provenance gaps. Treat
the remaining entries marked restricted or verification required as blockers
for commercial distribution. The authoritative working ledger and required
actions are in the root `THIRD_PARTY_ASSETS.md` file.

## Dependency Review

The production dependency audit (`npm audit --omit=dev`) is the release gate.
Review the complete `npm audit` output independently because development-tool
advisories can change without affecting the production image. The real-time stack was
migrated from Colyseus 0.15 to pinned compatible 0.18 packages, removing the
legacy `@colyseus/core`/`nanoid@2.1.11` advisory chain. The browser and load-test
clients now use `@colyseus/sdk`; server runtime packages are production
dependencies, and the obsolete `colyseus`/`colyseus.js` packages are absent.
The migration is covered by an in-process WebSocket test for server-side
location matching, proxy collection callbacks, and private `StateView` data.
Run current audits before every deployment because registry advisory data can
change.

## Reproduce

```bash
npm test
npm run check:localization
npm run check:web-quality
npx tsc --noEmit
npm run client-build
npm run server-build
npm run test:e2e
docker compose --env-file .env.public.example -f docker-compose.public.yml config --quiet
npm audit
npm audit --omit=dev
```

Run `npx playwright install chromium` once when the host has no compatible
browser. The listed commands work in PowerShell, cmd.exe, Bash, and CI; a
Linux-only system-browser override is unnecessary when Playwright manages Chromium.
After the automated run, manually verify both languages, onboarding/`F1`,
automatic camera behavior, the new key art/logo/icon set, and the deployed
social preview at `https://arkadii.world/game/`.
