# API and Security

This document describes the HTTP surface served by the same Node.js process as
the Arkadii Quest client and Colyseus rooms. Production traffic should reach
these routes through HTTPS at `https://arkadii.world/game/`; port `3000` stays
private inside the Docker network.

## Request Conventions

- New client code sends credentials and tokens in JSON request bodies.
- The Express JSON body limit is 32 KiB.
- `Content-Type: application/json` is required for JSON bodies.
- A few authentication routes retain query-string fallback for compatibility,
  but URLs must not be used for new credential or token integrations because
  proxies and access logs can retain them.
- Authentication responses omit the stored password field.

Example login request:

```bash
curl -sS https://arkadii.world/game/login \
  -H 'Content-Type: application/json' \
  --data '{"username":"example-user","password":"replace-this-value"}'
```

## HTTP Endpoints

| Method | Route | Purpose | Important Responses |
| --- | --- | --- | --- |
| `GET` | `/health` | Container and proxy health check | `200` with status and uptime |
| `GET` | `/metrics` | Prometheus text metrics | `200`; public in the current Caddy profile |
| `POST` | `/login` | Login or create a username that does not exist | `200`, `400`, `401`, `429`, or `500` |
| `POST` preferred | `/loginWithToken` | Validate a token and rotate it | `200`, `400`, `401`, or `500` |
| `POST` | `/check` | Validate the current user token and return characters | `200`, `400`, or `500` |
| `POST` | `/create_character` | Create a character for a valid token and validated customization | `200`, `400`, `401`, `409`, `429`, or `500` |
| `POST` | `/returnRandomUser` | Create a rate-limited Quick Play guest and starter character | `200`, `429`, `500`, or `503` |
| `GET` | `/load_game_data` | Return public item, ability, location, race, quest, and help data | `200` |
| `GET` | `/getHelpPage?page=...` | Return an allowlisted HTML help page | `200` or `400` |
| `GET` | `/get_character?character_id=...` | Authenticated character lookup | `200`, `400`, `401`, `404`, or `500` |
| `GET` | `/register` | Disabled legacy registration route | `501` |

The public reverse proxy removes the `/game` prefix before forwarding requests,
so `/game/login` externally maps to `/login` inside the server container.

## Login Behavior

`POST /login` combines account creation and login:

1. If the username does not exist, the server creates it and returns a user
   record with a fresh token.
2. If the username exists and the password matches, the server rotates the
   token and returns the user and character list.
3. If the username exists and the password is wrong, the server returns `401`
   and does not create a duplicate account.
4. Blank values return `400`. Usernames are trimmed and limited to 64
   characters; passwords are limited to 128 characters.
5. A process-local fixed window admits at most 10 password-login attempts per
   resolved client IP in 10 minutes. Excess requests return `429` with a
   `Retry-After: 600` header before another password lookup occurs.
6. MySQL and SQLite enforce a unique username. If two first-login requests race,
   the database admits one row; the losing request rechecks the password and
   resolves to that same identity only when the credentials match.

Quick Play creates a generated account and one starter character. The guest
password is never sent to the browser; the generated token is used for the
current session. Its separate process-local limit admits five requests per
resolved client IP in 10 minutes.

Direct character creation has its own five-request/10-minute IP limit. The
database also enforces at most five characters per account inside the same
transaction that creates the character and starter relations. MySQL locks the
owning user row during that check; SQLite uses its immediate write transaction.
The limit returns `409`, while excess HTTP attempts return `429` before another
token lookup or write.

## Password Storage and Migration

New passwords are derived with Node.js `scrypt` using a random 16-byte salt and
a 64-byte derived key. Stored values have this shape:

```text
scrypt$<hex-salt>$<hex-derived-key>
```

Existing plaintext rows remain compatible during rollout. After the user
successfully supplies the old password, the server replaces that row with a
`scrypt` value before completing login. Invalid passwords never trigger a
migration.

Before deploying this change over an existing production database:

1. Take and verify a database backup.
2. Report and resolve null, empty, overlong, or duplicate usernames. Never
   merge duplicate rows without manually verifying their passwords, character
   ownership, and intended account owner.
3. Deploy the application and monitor login failures.
4. Require a password reset or perform a separate migration for dormant legacy
   accounts that may never log in and therefore cannot self-migrate.

MySQL startup runs an idempotent schema check even when the bootstrap tables
already exist. It adds the single-column username unique key when the data is
clean. If unsafe legacy rows are present, startup fails with row IDs and leaves
all records untouched so an operator can restore/inspect the backup and resolve
ownership explicitly.

The response serializer removes `password` from `/login`, `/loginWithToken`, and
`/check`; Quick Play responses do not add it to the character payload.

## Token Handling

- Login and token login rotate the account token.
- The normal browser login stores the latest token in local storage.
- Logout removes the local token and clears the in-memory user and character.
- `/check` verifies the token before character selection or creation flows.
- Tokens are bearer credentials. Do not place them in logs, analytics events,
  screenshots, URLs, or bug reports.

## HTTP Delivery Policy

The Express runtime applies these controls before API and static routes:

| Control | Behavior |
| --- | --- |
| Server disclosure | `X-Powered-By` is disabled |
| Compression | Compressible responses use Express compression; Caddy also supports zstd/gzip |
| Mutable discovery files | `index.html`, `robots.txt`, `sitemap.xml`, and `manifest.webmanifest` use `no-cache` |
| Other static assets | One-hour cache with one-day `stale-while-revalidate` |
| JSON parser | 32 KiB request limit |
| Help pages | Filename allowlist blocks traversal outside the help directory |
| Browser CORS | Exact-origin allowlist; production defaults to `https://arkadii.world` and `https://www.arkadii.world` |
| WebSocket origin | The same allowlist rejects foreign browser upgrade requests with `403` |

Set a comma-separated override when another browser origin is intentional:

```env
CORS_ALLOWED_ORIGINS=https://arkadii.world,https://www.arkadii.world
```

Configured values must be complete `http://` or `https://` origins without a
path, credentials, query, or fragment. `*` is deliberately not supported. When
the variable is unset, development additionally permits
`https://arkadii.game.local`, localhost, and `127.0.0.1` on ports `3000` and
`8080`. Same-origin, health-check, and other non-browser requests may omit the
`Origin` header; CORS is a browser boundary, not API authentication.

## Real-Time Input and Room Lifecycle

Keyboard and touch movement use the same Colyseus player-input message. The
server treats its sequence, horizontal, and vertical components as untrusted
values:

- non-finite, missing, or non-numeric components are rejected;
- stale or repeated sequence numbers are rejected;
- vectors longer than one are normalized before speed is applied;
- near-zero vectors do not move the player;
- dead or server-blocked players cannot move;
- direct input and automated pursuit/click-to-move share one horizontal step
  allowance per simulation tick, and switching mode cancels the competing path;
- click-to-move advances by one normalized horizontal speed step, including on
  diagonal paths;
- navmesh clamping remains the final position boundary;
- the horizontal result of navmesh clamping cannot exceed the displacement
  requested from the server-owned movement speed.

Unknown game-message types are dropped. Per client, the game room allows a
40-message burst refilled at 40 messages/second, with narrower buckets for
direct and click movement together (burst 2, refill 10/second, matching the normal 100 ms client tick),
actions (burst 8, refill 8/second), and ping (burst 2, refill 1/second).
Ping accepts only a non-negative integer timestamp and returns a newly built
timestamp object rather than reflecting arbitrary client fields. Click-to-move targets are additionally
limited to finite world coordinates within 64 units of the player before any
navmesh pathfinding runs.
Combat targets are restricted to live player/creature schemas, pickup targets
to loot schemas, and failed target paths or failed pickup attempts are abandoned
instead of being recomputed every simulation tick. Prototype-chain data keys
are rejected.
Unexpected legacy message-handler exceptions are contained and disconnect only
the sending client; the room-level exception hook also protects lifecycle and
simulation callbacks.
WebSocket frames are capped at 8 KiB before protocol decoding.
Colyseus also caps inbound messages at 60/second for the game room and 20/second
for chat; chat retains its identity-bound six-message/10-second application
limit. These controls bound ordinary movement and action abuse, but they are
not a complete anti-cheat system or a substitute for server-authoritative
combat timing and anomaly monitoring.

Room startup awaits game-data and controller initialization before publishing
the Colyseus state or registering simulation work. Game and chat WebSockets
authenticate the token/owned character; chat ignores spoofed names and IDs. A
process-local reservation prevents parallel sessions for one character.
The supported single-server startup resets durable `online` markers left by an
interrupted prior process, preventing a crash or container restart from locking
a character out permanently. Horizontal deployment requires a shared leased
presence record rather than the current boolean marker.
Periodic, zone-transition, and disconnect persistence uses immutable snapshots
and an ordered per-character queue. Each complete character snapshot and each
new-character/default-loadout creation is now one SQL transaction on both
MySQL and SQLite, so a failed relation write rolls the whole operation back.
Disconnect cleanup waits for the final transaction before releasing the
reservation.

Ability activation resolves only an ability actually learned by the character
and assigned to that exact hotbar slot. New characters know the basic attack
and sweeping strike. Fire, poison, and healing training is authorized by the
server only while the character is within five world units of a trainer that
offers the exact ability and satisfies its level, stat, and gold requirements;
the server performs the gold deduction. Equipping checks the canonical item
requirements, and consumables use canonical effects with a per-item server
cooldown and inventory decrement before applying the effect.

World loot is limited to 128 entries per game room and expires after five
minutes. Drops are admitted before inventory is removed, so a full room cannot
destroy a player's item. Missing or malformed enemy reward ranges are treated
as no reward, and experience is validated and saturated before it enters the
networked/persisted state.

The real-time stack uses Colyseus 0.18 (`@colyseus/core` 0.18.10,
`@colyseus/schema` 5.0.27, `@colyseus/sdk` 0.18.2, and
`@colyseus/ws-transport` 0.18.2). Matchmaking is server-side and filtered by
the requested location, so clients no longer enumerate room metadata. Schema
callbacks use the 0.18 proxy API, and each player's private `player_data` field
is exposed only through that connection's `StateView`.

## Current Security Boundaries

The following items remain explicit follow-up work for a hardened public
service:

- Back session reservations and application rate limits with Redis or another
  shared store before running multiple Node workers; the current registries are
  process-local.
- Apply an infrastructure-level request limiter if the deployment needs a
  cross-process or cross-host password/Quick Play abuse boundary.
- Extend authoritative validation and anomaly monitoring to combat timing,
  pathing, economy events, and long-horizon movement behavior.
- Add account recovery and password rotation workflows.
- Decide whether `/metrics` should remain public or be restricted by Caddy.
- Resolve the asset-provenance blockers in `THIRD_PARTY_ASSETS.md` before a
  commercial asset release.

## Verification

Run the server with the SQLite fallback for host QA:

```bash
APP_DATABASE=sqllite npm run server-dev
```

Run source, localization, and browser behavior checks before deployment:

```bash
npm test
npm run check:localization
npm run server-build
npm run test:e2e
```

Then verify representative behavior:

```bash
curl -i http://127.0.0.1:3000/health
curl -i http://127.0.0.1:3000/check \
  -H 'Content-Type: application/json' \
  --data '{}'
curl -sS -D - -o /dev/null \
  -H 'Accept-Encoding: gzip' \
  http://127.0.0.1:3000/js/bundle.js
npm audit
npm audit --omit=dev
```

Expected results include a `400` response for the missing token, compressed
bundle delivery, no `X-Powered-By` header, and zero known vulnerabilities in
both npm audit scopes. The 6 September 2026 lockfile audit reported zero low,
moderate, high, or critical findings for the full and production dependency
trees. Advisory data changes over time, so both audits remain deployment-time
checks.
