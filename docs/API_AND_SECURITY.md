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
| `POST` | `/login` | Login or create a username that does not exist | `200`, `400`, `401`, or `500` |
| `POST` preferred | `/loginWithToken` | Validate a token and rotate it | `200`, `400`, `401`, or `500` |
| `POST` | `/check` | Validate the current user token and return characters | `200`, `400`, or `500` |
| `POST` | `/create_character` | Create a character for a valid token and validated customization | `200`, `400`, `401`, or `500` |
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

Quick Play creates a generated account and one starter character. The guest
password is never sent to the browser; the generated token is used for the
current session.

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
2. Deploy the application and monitor login failures.
3. Require a password reset or perform a separate migration for dormant legacy
   accounts that may never log in and therefore cannot self-migrate.

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
| CORS | Currently permissive for compatibility |

## Real-Time Input and Room Lifecycle

Keyboard and touch movement use the same Colyseus player-input message. The
server treats its horizontal and vertical components as untrusted values:

- non-finite or missing components become zero;
- vectors longer than one are normalized before speed is applied;
- near-zero vectors do not move the player;
- dead or server-blocked players cannot move;
- navmesh clamping remains the final position boundary.

This prevents a modified client from gaining diagonal speed or sending
`NaN`/infinite coordinates through the ordinary movement path. It is not a
complete anti-cheat system: movement rate, message frequency, teleport checks,
and authoritative time-based speed limits remain future hardening work.

Room startup now awaits game-data and controller initialization before
publishing the Colyseus state or registering normal simulation work. Game and
chat WebSockets authenticate the token/owned character; chat ignores spoofed
names and IDs. A process-local reservation prevents parallel sessions for one
character. Periodic, zone-transition, and disconnect persistence uses immutable
snapshots and an ordered per-character queue, and disconnect cleanup waits for
the final save before releasing the reservation.

## Current Security Boundaries

The following items remain explicit follow-up work for a hardened public
service:

- Add rate limiting for password login; Quick Play and chat already have bounded
  process-local limiters.
- Restrict CORS to intended production and development origins.
- Add per-client input-rate and authoritative displacement limits for stronger
  movement abuse protection.
- Back session reservations and rate limits with Redis before running multiple
  Node workers; the current registries are process-local.
- Wrap each multi-table character save/create operation in a database transaction
  so an adapter failure cannot leave a partially replaced relation set.
- Add account recovery and password rotation workflows.
- Decide whether `/metrics` should remain public or be restricted by Caddy.
- Migrate Colyseus 0.15 to a tested, supported current release (npm currently
  proposes 0.18) to resolve the remaining production dependency advisories.

## Verification

Run the server with the SQLite fallback for host QA:

```bash
APP_DATABASE=sqllite npm run server-dev
```

Run source, localization, and browser behavior checks before deployment:

```bash
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
npm audit --omit=dev
```

Expected results include a `400` response for the missing token, compressed
bundle delivery, and no `X-Powered-By` header. The September 2026 production
audit has one high transitive finding in the legacy Colyseus 0.15 dependency
chain; it is recorded in the quality audit and must not be hidden or treated as
a clean audit.
