# Infrastructure and Deployment

This guide is the runbook for the local Arkadii Quest Docker stack. For the
public internet profile at `https://arkadii.world/game/`, use
[Public Deployment](./PUBLIC_DEPLOYMENT.md).

## Deployment Profiles

| Profile | Compose File | Reverse Proxy | Public Host Ports | Primary Use |
| --- | --- | --- | --- | --- |
| Local | `docker-compose.yml` | nginx | `127.0.0.1:${HTTPS_PORT:-443}` | Full local stack with trusted local HTTPS |
| Public | `docker-compose.public.yml` | Caddy | `${PUBLIC_BIND:-0.0.0.0}:80`, `${PUBLIC_BIND:-0.0.0.0}:443` | Internet deployment with automatic HTTPS |

Both profiles run the same Node.js game server image, MySQL database,
Prometheus scraper, and Grafana service. The difference is the reverse proxy,
browser-facing path, and host port exposure.

## Local Stack Goals

- Run the complete application locally in containers.
- Use MySQL as the default containerized database.
- Serve the browser through memorable HTTPS domains.
- Keep raw service ports private inside Docker.
- Include Prometheus and Grafana for local observability.
- Keep generated certificates and secrets out of git.

## Local Architecture

```text
Browser
  |
  | https://arkadii.game.local
  | https://grafana.arkadii.game.local
  | https://prometheus.arkadii.game.local
  v
nginx web container
  |
  +-- server:3000      Node.js, Express, Colyseus, static client, docs
  +-- prometheus:9090  Prometheus UI and metrics store
  +-- grafana:3001     Grafana UI

server:3000
  |
  +-- mysql:3306       MySQL database
```

Only this host binding is expected in the local profile:

```text
127.0.0.1:443 -> web:443
```

## Services

| Compose Service | Image | Role |
| --- | --- | --- |
| `web` | `nginx:1.27-alpine` | HTTPS reverse proxy and domain router |
| `server` | local Dockerfile | Production Node.js server and built client |
| `mysql` | `mysql:8.4` | Persistent game database |
| `prometheus` | `prom/prometheus:v3.13.1` | Metrics scraping and storage |
| `grafana` | `grafana/grafana-oss:13.0.2` | Observability dashboard UI |

The multi-stage server image prunes development-only packages after the build
and runs the final Node.js process as the unprivileged `node` user.
On startup, the supported single server resets stale character-presence flags
left by an interrupted previous process. Horizontal replicas require a shared
lease/heartbeat design instead of the current boolean marker.
Both Compose profiles rotate each container's JSON logs at 10 MiB and retain
three files, preventing routine runtime output from growing without bound.

## Network Exposure

| Port | Service | Local Access |
| --- | --- | --- |
| `443` | nginx | Published on `127.0.0.1:${HTTPS_PORT:-443}` |
| `3000` | game server | Internal only, routed through nginx |
| `3306` | MySQL | Internal only |
| `9090` | Prometheus | Internal only, routed through nginx |
| `3001` | Grafana | Internal only, routed through nginx |

## Local Prerequisites

- Node.js 22 and npm.
- Docker with Docker Compose support.
- `openssl` for local certificate generation.
- Chromium for end-to-end input/layout QA. Install the Playwright-managed build
  with `npx playwright install chromium` when the host has no compatible
  browser.
- `sudo` access when the setup script needs to update `/etc/hosts` or the trust
  store.

## Environment Setup

Create the local environment file:

```bash
cp .env.example .env
```

Important local defaults:

| Variable | Default | Description |
| --- | --- | --- |
| `APP_PORT` | `3000` | Internal Node.js server port |
| `APP_DATABASE` | `mysql` | Database adapter used by the Docker stack |
| `APP_DOMAIN` | `arkadii.game.local` | Main game/docs domain |
| `GRAFANA_DOMAIN` | `grafana.arkadii.game.local` | Grafana browser domain |
| `PROMETHEUS_DOMAIN` | `prometheus.arkadii.game.local` | Prometheus browser domain |
| `HTTPS_PORT` | `443` | Host HTTPS port bound to nginx on localhost |
| `DATABASE_HOST` | `mysql` | MySQL hostname inside Docker |
| `DATABASE_DB` | `t5c` | MySQL database name |
| `DATABASE_USER` | `t5c` | MySQL application user |
| `DATABASE_PASSWORD` | `t5c_password` | MySQL application password |
| `MYSQL_ROOT_PASSWORD` | `t5c_root_password` | MySQL root password |
| `GRAFANA_ADMIN_USER` | `admin` | Grafana admin user |
| `GRAFANA_ADMIN_PASSWORD` | `admin` | Grafana admin password |
| `CLIENT_API_URL` | empty | Optional build-time API URL override |
| `CLIENT_WS_URL` | empty | Optional build-time WebSocket URL override |
| `CLIENT_BASE_PATH` | empty | Optional browser base path |
| `CORS_ALLOWED_ORIGINS` | Arkadii/local origins | Comma-separated exact browser origins allowed for HTTP CORS and WebSocket upgrades |

When `CLIENT_API_URL` and `CLIENT_WS_URL` are empty, the production client uses
the current HTTPS origin and `wss://` host.

## Host Development with SQLite

The container profile uses MySQL, but a host-only development server can use the
SQLite fallback. Start the server and Webpack client in separate terminals:

```bash
APP_DATABASE=sqllite npm run server-dev
```

```bash
npm run client-dev
```

The spelling `sqllite` matches the existing runtime configuration. The server
uses `./database.db`; this file is local runtime state and must not be committed.
Both clients first show language and control-mode selection. After that setup,
the dev client at `http://localhost:8080` enters the game scene directly, while
the built client served at `http://localhost:3000` uses the production login
flow. The connected game presents localized onboarding when appropriate, and
`F1` reopens its controls guide.

## Local DNS and TLS

Run this once per machine:

```bash
scripts/setup-local-domain.sh
```

The script performs these actions:

1. Reads domain settings from `.env` when present.
2. Creates a local certificate authority.
3. Creates a SAN server certificate for the game, Grafana, and Prometheus
   domains.
4. Adds missing `/etc/hosts` entries.
5. Installs the local CA into the system trust store when the OS supports it.

Generated files are written to:

```text
docker/nginx/certs/
```

That directory is ignored by git because it contains machine-local certificate
and key material.

## Build and Run

Start the local stack:

```bash
scripts/setup-local-domain.sh
docker compose up -d --build
```

Open:

| Surface | URL |
| --- | --- |
| Game | `https://arkadii.game.local` |
| Docs | `https://arkadii.game.local/docs` |
| Grafana | `https://grafana.arkadii.game.local` |
| Prometheus | `https://prometheus.arkadii.game.local` |

## Validation

Validate the Compose file before starting containers:

```bash
docker compose config
```

Validate source, browser discovery files, and both production builds:

```bash
npm test
npm run check:localization
npm run check:web-quality
npx tsc --noEmit
npm run client-build
npm run server-build
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
npm audit
npm audit --omit=dev
```

`client-build` currently emits size warnings for the 2.7 MiB entrypoint and
large world/VAT/audio assets. Those warnings are tracked performance debt, not a
failed build. After the tested Colyseus 0.18 migration, both the full and
production npm audits reported zero known vulnerabilities on 6 September 2026.
Audit data changes over time, so both commands remain part of pre-deployment QA.

The Playwright configuration starts an isolated SQLite server and Webpack dev
client when ports `3000` and `8080` are free. It runs one English desktop
keyboard/mouse project at `1440x900` and one Russian touch project at `412x915`,
including a short-landscape resize. Omit
`PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` when using the browser installed by
Playwright.

The browser checks exercise real WebGL movement, automatic follow-camera
behavior, onboarding/`F1`, hotkeys, chat, targeting, translated names, touch
target sizes, and panel/HUD separation. Test artifacts are written to ignored
`test-results/` and `playwright-report/` directories only when applicable.

After the stack is running, check service state and browser-facing health:

```bash
docker compose ps
curl -fsS https://arkadii.game.local/health
curl -fsS https://grafana.arkadii.game.local/api/health
curl -fsS https://prometheus.arkadii.game.local/-/healthy
```

Verify that Prometheus can scrape the game server:

```bash
docker compose exec -T server node -e "fetch('http://prometheus:9090/api/v1/targets').then(r => r.json()).then(j => console.log(JSON.stringify(j.data.activeTargets.map(t => ({ health: t.health, scrapeUrl: t.scrapeUrl, lastError: t.lastError })), null, 2)))"
```

Verify that only the HTTPS proxy is published on the host:

```bash
ss -ltnp | rg ':443\\b|:8080\\b|:3000\\b|:3001\\b|:3306\\b|:9090\\b'
```

Expected local result:

```text
127.0.0.1:443
```

## HTTP Delivery

The Node.js server applies compression and static cache headers even without a
reverse proxy. nginx or Caddy remains responsible for TLS and public security
headers.

| Resource Type | Cache Behavior |
| --- | --- |
| `index.html`, `robots.txt`, `sitemap.xml`, `manifest.webmanifest` | `no-cache` so metadata can be revalidated |
| JavaScript, CSS, models, textures, audio, docs content | One hour plus one-day `stale-while-revalidate` |
| API responses | No static cache policy |

Express disables `X-Powered-By`, limits JSON bodies to 32 KiB, and compresses
eligible responses. Verify delivery locally:

```bash
curl -sS -D - -o /dev/null \
  -H 'Accept-Encoding: gzip' \
  http://127.0.0.1:3000/js/bundle.js
curl -I http://127.0.0.1:3000/robots.txt
```

HTTP CORS and browser WebSocket upgrades use the same exact-origin allowlist.
Production defaults to `https://arkadii.world` and
`https://www.arkadii.world`; local defaults additionally include
`https://arkadii.game.local` and the documented localhost development ports.
Set `CORS_ALLOWED_ORIGINS` to a comma-separated list of complete `http://` or
`https://` origins when an intentional frontend host differs. Origin-less CLI,
same-origin, and health-check requests remain valid.

## WebSocket Smoke Test

Run the Colyseus smoke test through the local HTTPS/WSS domain:

```bash
SMOKE_TOKEN='<account-token>' \
SMOKE_CHARACTER_ID='<owned-character-id>' \
npm run smoke:ws
```

The default endpoint is `wss://arkadii.game.local` and the default room is
`chat_room`. Both credentials are required because smoke testing now exercises
the same token/character ownership boundary as the browser. Override the
endpoint when testing another environment:

```bash
SMOKE_WS_URL=wss://arkadii.world/game \
SMOKE_TOKEN='<account-token>' \
SMOKE_CHARACTER_ID='<owned-character-id>' \
npm run smoke:ws
```

To verify location-filtered game matchmaking, also provide the character's
persisted location (default `lh_town`):

```bash
SMOKE_ROOM=game_room \
SMOKE_LOCATION=lh_town \
SMOKE_TOKEN='<account-token>' \
SMOKE_CHARACTER_ID='<owned-character-id>' \
npm run smoke:ws
```

## Load Testing

Run the authenticated interactive Colyseus load test with a token and character
owned by that account:

```bash
LOADTEST_TOKEN=<account-token> \
LOADTEST_CHARACTER_ID=<owned-character-id> \
npm run loadtest
```

The default load test joins `chat_room` with 10 clients over
`wss://arkadii.game.local`. The scenario intentionally accepts only
`chat_room`; concurrent `game_room` load testing needs a different owned
character for every client. Quit the interactive terminal UI with `q` or
`Ctrl-C`.

## Observability

The server exposes Prometheus text metrics at:

```text
server:3000/metrics
```

Prometheus scrapes that internal endpoint. Grafana is provisioned with
Prometheus as the default datasource.

Initial metrics:

| Metric | Meaning |
| --- | --- |
| `t5c_server_uptime_seconds` | Server process uptime |
| `t5c_server_memory_rss_bytes` | Resident memory used by the server process |

These `t5c_*` series are legacy compatibility identifiers, not public branding.
Keep them until dashboards, alert rules, scrapers, and any external consumers
can migrate together; a transition should dual-publish old and new names before
the legacy series are retired. Additional game metrics can be added without
changing the Docker network layout.

## Data Persistence

MySQL data is stored in the named Docker volume:

```text
t5c-platform-devops_mysql_data
```

The volume name and the `t5c` database/user defaults are legacy compatibility
identifiers. Renaming the Compose project, volume, database, or user in place
does not rebrand existing data; it can instead attach a new empty volume or
break database grants. Keep the current identifiers until a backed-up,
explicitly tested migration updates all Compose files, environments, grants,
dashboards, and restore procedures together.

Routine restart without deleting database data:

```bash
docker compose down
docker compose up -d
```

Full reset, including database data:

```bash
docker compose down -v
docker compose up -d --build
```

Only use `down -v` when you intentionally want to remove local MySQL data.

### Transactional Character Writes

Complete new-character creation (character row plus starter abilities, hotbar,
equipment, and inventory) and complete player snapshot saves run in one adapter
transaction. MySQL uses begin/commit/rollback and SQLite uses an immediate
transaction. Database operations are serialized per adapter so another
statement cannot enter the active transaction; any failed relation write rolls
the complete operation back. Creation is limited to five characters per account
inside that transaction; MySQL locks the owning user row so concurrent server
processes cannot both pass the count check.

### Credential Migration

New account passwords are stored with salted `scrypt`. A successful login with
an older plaintext row upgrades that row automatically. Back up MySQL before
deploying the new server over an existing user database, and define a password
reset plan for dormant accounts that cannot self-migrate. Authentication
responses no longer include the password column. Password login is limited per
resolved client IP to 10 attempts in 10 minutes, and Quick Play to five requests
in 10 minutes. Direct character creation has a separate five-request limit and
a durable five-character account cap; the fixed-window maps are process-local.

MySQL startup also runs an idempotent username migration after either a fresh
bootstrap or detection of an existing schema. Clean databases receive a
single-column unique key on `users.username`, closing cross-process first-login
races. Null, empty, overlong, or duplicate legacy usernames stop startup with a
non-destructive diagnostic; the server never guesses which credentials or
characters should be merged. Take a verified backup and resolve those rows
manually before retrying the deployment.

## Operations

| Task | Command |
| --- | --- |
| Start or update the stack | `docker compose up -d --build` |
| Stop containers and keep data | `docker compose down` |
| Stop containers and delete volumes | `docker compose down -v` |
| Show logs for all services | `docker compose logs --tail=100` |
| Show server logs | `docker compose logs --tail=100 server` |
| Rebuild only the game image | `docker compose build server` |
| Validate public profile syntax | `docker compose --env-file .env.public -f docker-compose.public.yml config` |
| Validate Caddy syntax | `docker run --rm -v "$PWD/docker/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile` |
| Validate web metadata/docs | `npm run check:web-quality` |

## Public Deployment Link

The repository includes a dedicated public profile:

```bash
docker compose --env-file .env.public -f docker-compose.public.yml up -d --build
```

That profile uses Caddy for automatic Let's Encrypt certificates, publishes
ports `80` and `443`, serves the game at `https://arkadii.world/game/`, and
keeps MySQL, Prometheus, and Grafana private inside Docker. See
[Public Deployment](./PUBLIC_DEPLOYMENT.md) before running it.

## Troubleshooting

### Browser Does Not Trust the Certificate

Run:

```bash
scripts/setup-local-domain.sh
```

Then restart the browser if it cached the old certificate state.

### Domain Does Not Resolve

Check local host records:

```bash
getent hosts arkadii.game.local grafana.arkadii.game.local prometheus.arkadii.game.local
```

Each domain should resolve to `127.0.0.1`.

### Port 443 Is Busy

Change `HTTPS_PORT` in `.env` and restart the stack:

```bash
docker compose up -d
```

If `HTTPS_PORT` is not `443`, include the port in browser URLs.

### Server Is Healthy but WebSocket Fails

Check nginx logs:

```bash
docker compose logs --tail=100 web
```

The nginx config forwards `Upgrade` and `Connection` headers for Colyseus
WebSocket traffic. A browser upgrade whose `Origin` is absent from
`CORS_ALLOWED_ORIGINS` is deliberately rejected with `403`; check that variable
before treating this response as a proxy fault.

### Browser Shows the Startup Fallback

The client now replaces an indefinite loader with an actionable error when
WebGL or a required asset fails. Confirm that hardware acceleration and WebGL
are enabled, inspect the browser console and network panel, and verify that
models and VAT files return `200` through the proxy. The Retry action reloads
the complete client state.

### MySQL Data Disappeared

Check whether the volume was removed with:

```bash
docker compose down -v
```

Normal `docker compose down` keeps data.
