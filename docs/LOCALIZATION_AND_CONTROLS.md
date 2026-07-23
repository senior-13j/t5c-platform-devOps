# Localization and Controls

This document describes the bilingual entry flow and the two input profiles
introduced on branch `feature/localization-control-modes`. The supported
languages are English (`en`) and Russian (`ru`); the supported control modes
are keyboard/mouse and touch screen.

## Entry Preferences

The game opens with an accessible setup dialog before Babylon.js starts. The
player selects both a language and a control profile, then continues into the
normal login or development scene flow.

| Preference | Default | Storage Key | Behavior |
| --- | --- | --- | --- |
| Language | Russian when `navigator.language` begins with `ru`; English otherwise | `t5c_locale` | Changes entry metadata, HTML text, Babylon GUI, game data, dialogs, entity names, help, and supported server notifications |
| Controls | Touch on a coarse pointer or viewport below 700 px; keyboard/mouse otherwise | `t5c_control_mode` | Enables only the selected gameplay input profile and its matching help text |

Stored values preselect the next session, but the dialog remains available on
every load so a shared device can change either preference before entering the
game. If local storage is unavailable, the session still works with detected
defaults.

The setup surface is a native HTML `role="dialog"` with `aria-modal`, a visible
heading and description, native radio inputs, keyboard focus styling, localized
labels, and a touch-sized submit action. Changing language updates the document
`lang`, title, description, Open Graph/Twitter metadata, visible copy, titles,
and ARIA labels before the form is submitted.

## Localization Architecture

Localization is intentionally client-side because public game data remains the
shared server contract.

| Module | Responsibility |
| --- | --- |
| `src/client/i18n.ts` | Typed English/Russian UI catalog, content catalog, interpolation, game-data localization, entity-name refresh, and supported server-message translation |
| `src/client/Controllers/PreferencesController.ts` | Detection, persistence, entry dialog, metadata, DOM text, and accessibility attributes |
| `src/client/Controllers/GameController.ts` | Exposes the active locale/control mode and localizes downloaded game data before scenes consume it |
| `scripts/check-localization.ts` | Validates catalog parity, placeholders, source-data coverage, dialog structure, HTML bindings, and literal translation calls |

The localized content catalog covers active abilities, items, races, quest
titles/descriptions/objectives, locations, NPCs, enemies, interactive dialog
lines and buttons, help content, UI panels, tooltips, chat text, status messages,
loading/errors, character flows, and entry controls. Network entity patches are
followed by a localized-name refresh so a moving NPC or enemy cannot revert to
its server-language name.

Translation keys are inferred from the English catalog. A missing or misspelled
literal key therefore fails TypeScript compilation, while the localization
check catches dynamic data and HTML coverage that static typing cannot prove.
English and Russian placeholders must match exactly.

## Keyboard and Mouse

Keyboard gameplay input is ignored while a native field or Babylon chat input
has focus. Movement is camera-relative and normalized, so diagonal movement is
not faster than movement on one axis.

| Input | Action |
| --- | --- |
| `W`, `A`, `S`, `D` or arrow keys | Move relative to the current camera |
| Right- or middle-button drag | Rotate the camera |
| Mouse wheel | Zoom the camera |
| Left click | Select or interact with a visible entity/object through the existing world interaction |
| `1` through `9` | Use the matching hotbar slot |
| `E` | Interact with the nearest available character or object |
| `Tab` | Select the nearest valid target |
| `Enter` | Focus chat; submitting returns focus to the game |
| `I` | Open inventory |
| `J` | Open quests |
| `K` | Open abilities |
| `C` | Open character information/equipment |
| `H` | Open help |
| `Escape` | Close active panels |
| `Home` | Capture a game screenshot through the existing menu action |

Movement is cleared when the window loses focus, the page becomes hidden, chat
opens, or the scene is disposed. The canvas context menu is disabled only for
the selected keyboard/mouse profile so right-drag camera control remains usable.

## Touch Screen

Touch mode is designed for phones and tablets rather than emulating desktop
mouse events.

| Control | Action |
| --- | --- |
| Lower-left virtual joystick | Analog, camera-relative movement with a dead zone and normalized speed |
| Swipe on the 3D world | Rotate the camera |
| Tap an entity or object | Use the existing selection/interaction path |
| Bottom hotbar | Use abilities and items directly |
| Interact button | Interact with the nearest available object or character |
| Target button | Select the nearest valid target |
| Chat button | Show or hide chat and its input |
| Zoom buttons | Move the camera closer or farther away |
| Main menu | Open inventory, quests, abilities, character, and help panels |

Interactive controls use approximately 44 CSS px or larger targets. The HUD,
hotbar, joystick, action controls, status bars, chat, hints, and panels have
separate portrait and short-landscape layouts. Opening a full game panel in
touch mode temporarily hides the underlying HUD and DOM controls, preventing
unintended actions and visual overlap. Hover-only hotbar tooltips are disabled
in touch mode so a tap cannot leave a tooltip over gameplay.

Babylon GUI dimensions are converted from CSS pixels into the GUI render
texture's coordinate space. This matters when mobile hardware scaling is
active: using browser CSS dimensions directly previously made panels and HUD
controls overflow by roughly the hardware scale factor.

## Accessibility

- The entry dialog is operable with keyboard, pointer, and touch input.
- Current language is reflected by the document `lang` attribute.
- Dynamic labels, titles, descriptions, instructions, and ARIA names follow the
  selected language and control mode.
- Focus remains visible in the HTML shell and chat uses Babylon's official
  focused-control API.
- Touch actions have stable target sizes and do not resize the surrounding HUD.
- Reduced-motion behavior from the existing entry shell remains intact.

The 3D world and Babylon GUI are still primarily visual. Full screen-reader
parity for combat, inventory, and world navigation would require a parallel DOM
command layer and is not claimed by this release.

## Verification

Run the deterministic localization audit:

```bash
npm run check:localization
```

The current check covers 180 UI keys, 81 localized content pairs, 49 HTML
bindings, and 133 typed translation calls. It also verifies the source keys and
shape of every active ability, item, race, quest, location spawn, dialog, and
dialog action.

Install a Playwright browser once when the machine has no compatible Chromium:

```bash
npx playwright install chromium
```

Then run both desktop and touch projects:

```bash
npm run test:e2e
```

To use a system browser explicitly:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
```

The desktop project verifies persisted English/keyboard preferences, entry
semantics, real WASD displacement, hotbar and menu hotkeys, interaction,
targeting, chat focus/submission, panel closing, mouse camera rotation, and
wheel zoom. The touch project verifies persisted Russian/touch preferences,
real joystick displacement through native touch events, swipe camera rotation,
localized target names, interaction, both zoom directions, hotbar use,
touch-target sizes, chat, portrait panel fit, short-landscape panel fit, and
panel/HUD separation. Both projects fail on page errors, console errors, or
unexpected failed requests.

## Patch Notes

### Added

- English/Russian setup before game startup with persisted, device-aware
  defaults.
- Complete typed localization for active UI, gameplay content, help, dialogs,
  metadata, accessibility text, and supported server notifications.
- Dedicated keyboard/mouse controls with WASD, number-row abilities, panel
  hotkeys, nearest interaction/targeting, chat focus, and camera drag.
- Dedicated touch controls with a virtual joystick, world swipe, contextual
  action buttons, chat and zoom controls, responsive portrait/landscape HUDs.
- Automated localization validation and desktop/touch Playwright coverage.

### Fixed

- Replaced invalid Babylon `InputText.focus()`/`blur()` assumptions with
  `AdvancedDynamicTexture.focusedControl` and corrected chat focus detection.
- Deferred chat focus after `Enter` so the same keyboard event no longer opens
  and immediately closes the input.
- Removed duplicate `Version` text from the displayed client version.
- Normalized client and server movement vectors, including diagonal input and
  contradictory key combinations, and rejected non-finite movement values.
- Cleared movement on blur, page hiding, chat focus, and scene disposal to stop
  stuck movement.
- Blocked movement for dead or server-blocked players.
- Awaited asynchronous room-state initialization before publishing the Colyseus
  state, preventing joins against partially initialized controllers.
- Guarded room-leave cleanup when state, authentication, or database setup is
  incomplete.
- Converted responsive Babylon GUI geometry through render-texture scaling,
  fixing mobile overflow under hardware scaling.
- Reflowed Russian character statistics and clamped the equipment grid to the
  actual panel width.
- Hid HUD layers while a touch panel is open, eliminating panel, hotbar, status,
  chat, hint, and action-control collisions.
- Preserved localized NPC/enemy names after subsequent network state patches.
- Prevented touch hotbar tooltips from remaining stuck over the world.
- Repositioned control hints and removed their short-landscape overlap.
- Enlarged compact menu, panel-close, chat, inventory, and dialog actions to
  practical touch targets.

## Known Limits

- Language and input mode are selected before startup; switching them during an
  active world session requires reloading and choosing again.
- Chat messages written by players are not machine translated.
- Server notification translation covers current known templates. New server
  message templates must be added to the localization layer and its checks.
- Full assistive-technology access to the visual 3D world remains future work.
