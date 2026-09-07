# Project Overview

Arkadii Quest (`Аркадия Квест`) is a multiplayer 3D top-down RPG set in
Arkadia (`Аркадия`). It is built with Babylon.js, Colyseus, Express,
TypeScript, and SQL persistence. The project includes a responsive bilingual
browser client, native HTML preference/login/failure states, keyboard and touch
input profiles, a real-time game server, local and public container profiles,
observability, and served project documentation.

## Runtime Shape

The application has one browser client and one Node.js runtime service. In the
Docker profiles, the Node.js service serves the built client and docs, REST API,
Colyseus WebSocket rooms, health checks, and Prometheus metrics.

```text
Browser
  |
  | HTTPS + WSS
  v
reverse proxy
  |
  v
server:3000
  |
  +-- Express API and static delivery
  +-- Colyseus game_room and chat_room
  +-- /health and /metrics
  +-- built game client and rendered docs
  |
  v
MySQL in Docker or SQLite for host development
```

## Source Areas

| Area | Main Paths | Responsibility |
| --- | --- | --- |
| Client | `src/client` | Babylon.js scenes, localized responsive GUI, entities, adaptive input, asset loading, and networking |
| Localization | `src/client/i18n.ts`, `src/client/Controllers/PreferencesController.ts` | Typed catalogs, game-data overlays, locale/control persistence, metadata, DOM bindings, and entry selection |
| Web shell | `public/index.html`, `public/styles.css` | Semantic preference dialog, login form, touch controls, loading/error states, metadata, and static assets |
| Shared | `src/shared` | Runtime config, types, utility classes, and game math helpers |
| Server | `src/server` | Express API, Colyseus rooms, game state, authentication, persistence, and static delivery |
| Data | `database` | MySQL and SQLite schema bootstrap files |
| Quality | `scripts/check-localization.ts`, `scripts/check-web-quality.mjs`, `tests/e2e` | Translation integrity, metadata/discovery assertions, and real WebGL desktop/touch behavior |
| Infrastructure | `Dockerfile`, `docker-compose*.yml`, `docker` | Local and public container profiles, proxies, metrics, and dashboards |
| Documentation | `README.md`, `docs`, `public/docs` | Repository guides and the browser documentation viewer |

## Build Output

The production build creates these runtime outputs:

| Output | Created By | Contents |
| --- | --- | --- |
| `dist/client` | `npm run client-build` | Minified Webpack bundle, public assets, metadata/discovery files, docs shell, and copied Markdown |
| `dist/server` | `npm run server-build` | Compiled TypeScript server |
| `dist/public` | `npm run server-build` | Server-side public files used by compiled runtime paths such as navmesh loading |

The Dockerfile uses Node.js 22 for dependency, build, and runtime stages. It
builds both outputs, prunes development dependencies, and starts:

```bash
node dist/server/server/index.js
```

## Client Scene Flow

The production browser flow is:

```text
HTML loading shell
  -> Language and control-mode selection
  -> Login or Quick Play
  -> Character selection
  -> Character editor when requested
  -> Connected game scene
  -> First-entry onboarding and controls guide
```

The Webpack development origin opens the game scene directly to shorten local
iteration. The production client served from port `3000` starts at login.

Native HTML owns the initial interaction states:

- an accessible English/Russian and keyboard/touch preference dialog before
  the engine starts;
- labeled username and password controls with browser validation;
- keyboard focus and live login feedback;
- loading text and an ARIA progress bar;
- a focused Retry action for WebGL, startup, or asset failures;
- semantic game title, description, instructions, and announcements.

The connected scene presents a localized onboarding guide when appropriate.
It teaches movement, interaction, targeting, combat slots, chat, and panels;
`F1` reopens the controls guide after it has been dismissed on desktop, while a
dedicated guide button provides the same action on touch screens.

Babylon GUI owns character management and in-game interaction. The selected
locale is applied to downloaded active game data before scenes consume it.
Compact viewport logic adapts the menu, chat, hotbar, status bars, draggable
panels, character selection, and character editor at widths below 700 pixels or
on coarse-pointer devices. Compact rendering uses a higher hardware scaling
level and disables scene shadows to reduce GPU cost.

## Input Profiles

`PreferencesController` stores the selected locale and control mode after the
entry dialog. The current storage keys are `arkadii_quest_locale` and
`arkadii_quest_control_mode`; values from the former `t5c_*` keys are migrated
once and the legacy keys are removed.
A coarse pointer or viewport below 700 px recommends touch mode; otherwise
keyboard/mouse is recommended. The dialog appears on first entry; returning
players go directly to login and can reopen the choice through the language and
controls link.

Keyboard/mouse mode provides camera-relative WASD/arrow movement, number-row
hotbar actions, panel hotkeys, nearest interaction and targeting, chat focus,
panel dismissal, and `F1` access to onboarding. Touch mode creates a DOM
joystick and action cluster for interaction, targeting, and chat; the Babylon
hotbar remains directly tappable.

Both profiles use the same automatic follow camera. It tracks the active
character and maintains a stable top-down composition, so mouse-wheel zoom,
mouse-drag rotation, and touch-swipe rotation are not part of normal play.

Movement vectors are normalized client-side and validated again server-side.
The server rejects stale sequences and non-finite input, bounds the resulting
navmesh displacement, shares one step per simulation tick across direct and
automated movement, and applies movement/action/message budgets per client.
Input is suspended on blur, page hiding, chat focus, and scene disposal.
Touch panels hide underlying HUD controls to avoid overlap and accidental activation.
See [Localization and Controls](./LOCALIZATION_AND_CONTROLS.md) for the complete
mapping and validation matrix.

## Asset Loading

The client first loads public game data, then builds asset queues for the active
scene. The asset controller:

1. Groups entries by type, extension, and source filename.
2. Assigns one loaded value to every logical alias that shares the source.
3. Skips aliases already present in the game asset cache.
4. Reports progress through the native loading UI.
5. Promotes failed required assets to the actionable fatal-error state.

The latest recorded production entrypoint is about 2.7 MiB and the first world
transfer about 17.8 MiB. Large VAT files, models, audio, and dormant race assets
remain candidates for route-based loading and provenance review. See
[Game Quality Audit](./GAME_QUALITY_AUDIT.md) and the repository-level
`THIRD_PARTY_ASSETS.md` ledger.

## Browser URL Resolution

Local Docker serves the game from:

```text
https://arkadii.game.local
```

The public profile serves it from:

```text
https://arkadii.world/game/
```

Production URL resolution is same-origin by default:

| Setting | Default Behavior |
| --- | --- |
| `CLIENT_API_URL` empty | API calls use `window.location.origin` plus `CLIENT_BASE_PATH` |
| `CLIENT_WS_URL` empty | Colyseus uses `wss://`, the current host, and `CLIENT_BASE_PATH` |
| `CLIENT_BASE_PATH` empty | Local Docker serves from `/` |
| `CLIENT_BASE_PATH=/game` | Public Docker serves client, API, docs, and WebSockets under `/game` |

This keeps raw Node.js ports private and lets nginx or Caddy own browser-facing
TLS and paths.

## Server Runtime

The server process starts:

- the selected SQL database adapter;
- Express with a 32 KiB JSON limit, compression, exact-origin CORS, and static
  cache policy;
- the Colyseus 0.18 game server and `game_room` / `chat_room` handlers, with the
  same origin policy applied to browser WebSocket upgrades;
- static client and docs delivery from `dist/client`;
- `/health` and `/metrics` operational endpoints;
- authentication, character, game-data, and help routes.

Authentication requests use JSON bodies in the current client. New passwords
are stored with salted `scrypt`; a valid login automatically upgrades a legacy
plaintext row. Password fields are removed from every authentication response.
Password login and Quick Play have process-local per-IP fixed-window limits.
See [API and Security](./API_AND_SECURITY.md) for endpoint behavior and
remaining hardening work.

## Persistence

The Docker profiles use MySQL by default:

```env
APP_DATABASE=mysql
DATABASE_HOST=mysql
DATABASE_DB=t5c
DATABASE_USER=t5c
DATABASE_PASSWORD=replace-with-a-secret
```

The `t5c` database and user values above are temporary legacy identifiers kept
to preserve existing deployments. Changing them without migrating grants,
data, environment files, backups, and Compose volumes can make a healthy
database appear empty. The same compatibility rule applies to current
`t5c_*` Prometheus series and Compose volume/project names: keep them stable
until a coordinated migration is available.

Host development can use the SQLite adapter without MySQL:

```bash
APP_DATABASE=sqllite npm run server-dev
```

`sqllite` is intentionally documented with the spelling used by the existing
configuration branch. SQLite defaults to `./database.db`.

Schema bootstrap is guarded for both adapters. If the expected user table
already exists, startup skips importing the schema so container restarts do not
drop persistent data. Database backups are still required before deployment,
especially when rolling out credential migration behavior.

After the MySQL bootstrap guard, an idempotent migration still verifies that
`users.username` is non-null and uniquely indexed. It applies the missing key to
clean legacy data, while null/empty/overlong or duplicate usernames fail startup
without mutating or merging ambiguous accounts. Concurrent first logins are
resolved by this database constraint and credential recheck, so separate server
processes cannot create two identities with the same name.

New-character creation, including its starter relations, is atomic and capped
at five characters per account. Periodic, zone-transition, and disconnect saves
persist a complete immutable snapshot in one transaction. Both MySQL and SQLite
serialize adapter operations and roll back the complete character operation
after any failed relation write.

## Search and Discovery

The game entry document includes:

- a canonical URL and descriptive title/description;
- Open Graph and Twitter metadata using Arkadii Quest artwork;
- Schema.org `VideoGame` JSON-LD declaring English and Russian availability;
- a web app manifest and theme metadata;
- semantic content available before WebGL starts.

The public profile exposes root discovery files while the application remains
under `/game/`:

| File | Public URL |
| --- | --- |
| `robots.txt` | `https://arkadii.world/robots.txt` |
| `sitemap.xml` | `https://arkadii.world/sitemap.xml` |
| `llms.txt` | `https://arkadii.world/llms.txt` |
| `manifest.webmanifest` | `https://arkadii.world/game/manifest.webmanifest` |

Analytics does not load on localhost or `127.0.0.1`, and it is skipped when the
browser reports Do Not Track.

## Important Scripts

| Command | Purpose |
| --- | --- |
| `npm test` | Run unit, security, database rollback, and Colyseus protocol tests |
| `npm run client-dev` | Run the Webpack client with hot reload on port `8080` |
| `APP_DATABASE=sqllite npm run server-dev` | Run the host server with reload and SQLite on port `3000` |
| `npm run client-build` | Build the production client and copy assets/docs |
| `npm run server-build` | Compile the server and copy server-side public files |
| `npm run check:localization` | Validate English/Russian catalogs, placeholders, active game data, dialogs, HTML bindings, and literal calls |
| `npm run check:web-quality` | Validate HTML semantics, JSON-LD, manifest, crawler files, and references |
| `npm run test:e2e` | Start SQLite/server/client fixtures and run desktop plus touch Chromium projects |
| `npx tsc --noEmit` | Type-check client and server without writing output |
| `SMOKE_TOKEN=... SMOKE_CHARACTER_ID=... npm run smoke:ws` | Join the default Colyseus room through local HTTPS/WSS with owned-character credentials |
| `LOADTEST_TOKEN=... LOADTEST_CHARACTER_ID=... npm run loadtest` | Run the authenticated Colyseus chat-room load test |
| `npm run check:public` | Check DNS and host readiness for `arkadii.world` |
| `npm audit` | Audit the complete dependency tree |
| `npm audit --omit=dev` | Audit the production dependency tree only |
| `scripts/setup-local-domain.sh` | Prepare local HTTPS domains and certificates |
| `docker compose up -d --build` | Build and run the complete local container stack |

## Repository Documentation

Markdown sources live in `docs/`. Webpack copies them to:

```text
dist/client/docs/content/*.md
```

The browser shell in `public/docs` fetches that Markdown at runtime. Its
navigation covers the project overview, localization/controls reference,
API/security reference, quality audit, local infrastructure runbook, and public
deployment runbook. Copyright provenance and asset licensing are maintained in
the root `NOTICE.md` and `THIRD_PARTY_ASSETS.md` files.
