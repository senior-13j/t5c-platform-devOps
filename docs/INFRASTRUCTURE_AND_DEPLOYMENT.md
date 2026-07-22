# Infrastructure and Deployment

This guide documents the containerized local infrastructure and the deployment assumptions for T5C.

## Goals

The infrastructure work is built around these constraints:

- the whole application must run locally in containers;
- MySQL is the default database for the containerized stack;
- public access should use friendly local HTTPS domains;
- raw service ports must not be exposed directly on the host;
- the stack should be observable through Prometheus and Grafana;
- generated certificates and secrets must stay out of git.

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
  +-- grafana:3001     Grafana UI
  +-- prometheus:9090  Prometheus UI and metrics store

server:3000
  |
  +-- mysql:3306       MySQL database
```

Only this host binding is expected:

```text
127.0.0.1:443 -> web:443
```

The following ports are internal Docker ports only:

| Port | Service | External Access |
| --- | --- | --- |
| `3000` | game server | through `https://arkadii.game.local` |
| `3306` | MySQL | not exposed |
| `9090` | Prometheus | through `https://prometheus.arkadii.game.local` |
| `3001` | Grafana | through `https://grafana.arkadii.game.local` |

## Services

| Compose Service | Image | Role |
| --- | --- | --- |
| `web` | `nginx:1.27-alpine` | HTTPS reverse proxy and domain router |
| `server` | local Dockerfile | production Node.js server and built client |
| `mysql` | `mysql:8.4` | persistent game database |
| `prometheus` | `prom/prometheus:v3.13.1` | metrics scraping and storage |
| `grafana` | `grafana/grafana-oss:13.0.2` | observability dashboards |

## Local DNS and TLS

Run this once per machine:

```bash
scripts/setup-local-domain.sh
```

The script:

1. reads domain settings from `.env` when present;
2. creates a local certificate authority;
3. creates a SAN server certificate for all local domains;
4. adds `/etc/hosts` entries when missing;
5. installs the local CA into the system trust store when supported.

Generated files are written to:

```text
docker/nginx/certs/
```

Certificate and key files are intentionally ignored by git.

## Environment Variables

| Variable | Default | Description |
| --- | --- | --- |
| `APP_PORT` | `3000` | internal Node.js server port |
| `APP_DATABASE` | `mysql` | database adapter used by the app |
| `APP_DOMAIN` | `arkadii.game.local` | main game/docs domain |
| `GRAFANA_DOMAIN` | `grafana.arkadii.game.local` | Grafana domain |
| `PROMETHEUS_DOMAIN` | `prometheus.arkadii.game.local` | Prometheus domain |
| `HTTPS_PORT` | `443` | host HTTPS port bound to nginx on localhost |
| `DATABASE_HOST` | `mysql` | MySQL service hostname inside Docker |
| `DATABASE_DB` | `t5c` | MySQL database name |
| `DATABASE_USER` | `t5c` | MySQL application user |
| `DATABASE_PASSWORD` | `t5c_password` | MySQL application password |
| `MYSQL_ROOT_PASSWORD` | `t5c_root_password` | MySQL root password for the container |
| `GRAFANA_ADMIN_USER` | `admin` | Grafana admin user |
| `GRAFANA_ADMIN_PASSWORD` | `admin` | Grafana admin password |
| `CLIENT_API_URL` | empty | optional client API override baked into the bundle |
| `CLIENT_WS_URL` | empty | optional client WebSocket override baked into the bundle |

When `CLIENT_API_URL` and `CLIENT_WS_URL` are empty, the production client uses the current HTTPS origin and `wss://` host.

## Build and Run

```bash
scripts/setup-local-domain.sh
docker compose up -d --build
```

Open the game:

```text
https://arkadii.game.local
```

Open docs:

```text
https://arkadii.game.local/docs
```

Open observability:

```text
https://grafana.arkadii.game.local
https://prometheus.arkadii.game.local
```

## Health and Validation

Run these checks before pushing infrastructure changes:

```bash
docker compose config
docker compose ps
curl -fsS https://arkadii.game.local/health
curl -fsS https://grafana.arkadii.game.local/api/health
curl -fsS https://prometheus.arkadii.game.local/-/healthy
```

Verify that Prometheus can scrape the game server:

```bash
docker compose exec -T server node -e "fetch('http://prometheus:9090/api/v1/targets').then(r => r.json()).then(j => console.log(JSON.stringify(j.data.activeTargets.map(t => ({ health: t.health, scrapeUrl: t.scrapeUrl, lastError: t.lastError })), null, 2)))"
```

Verify that only HTTPS is published on the host:

```bash
ss -ltnp | rg ':443\\b|:8080\\b|:3000\\b|:3001\\b|:3306\\b|:9090\\b'
```

Expected result:

```text
127.0.0.1:443
```

## WebSocket Smoke Test

Node.js may need `--use-system-ca` to trust the local CA that browsers already trust through the OS store:

```bash
npm run smoke:ws
```

The default endpoint is `wss://arkadii.game.local`. Override it with `SMOKE_WS_URL` when testing another environment.

## Load Testing

Run the interactive Colyseus load test against the containerized HTTPS/WSS domain:

```bash
npm run loadtest
```

The default load test joins `chat_room` with 10 clients. Quit the interactive terminal UI with `q` or `Ctrl-C`.

## Data Persistence

MySQL data is stored in the named Docker volume:

```text
t5c-platform-devops_mysql_data
```

Do not remove this volume unless you intentionally want to reset local game data.

Reset all containers without deleting database data:

```bash
docker compose down
docker compose up -d
```

Reset containers and database data:

```bash
docker compose down -v
docker compose up -d --build
```

## Observability

The server exposes Prometheus text metrics at:

```text
server:3000/metrics
```

Prometheus scrapes that internal endpoint. Grafana is provisioned with Prometheus as the default datasource.

The initial metrics are intentionally small:

- `t5c_server_uptime_seconds`
- `t5c_server_memory_rss_bytes`

Additional game metrics can be added later without changing the Docker network layout.

## Deployment Notes

The current compose stack is a local development deployment. For a shared environment:

- replace local `.game.local` domains with real DNS records;
- replace generated local certificates with certificates from the target environment;
- use managed secrets instead of plain `.env` values;
- keep MySQL on a private network;
- publish only the reverse proxy;
- add backups for the MySQL volume or move persistence to managed MySQL;
- avoid publishing Prometheus and Grafana without authentication and access control.

## Troubleshooting

### Browser Does Not Trust the Certificate

Run:

```bash
scripts/setup-local-domain.sh
```

Then restart the browser if it had cached the old certificate state.

### Domain Does Not Resolve

Check `/etc/hosts`:

```bash
getent hosts arkadii.game.local grafana.arkadii.game.local prometheus.arkadii.game.local
```

Each domain should resolve to `127.0.0.1`.

### Port 443 Is Busy

Change `HTTPS_PORT` in `.env` and run:

```bash
docker compose up -d
```

If `HTTPS_PORT` is not `443`, include the port in browser URLs.

### Server Is Healthy but WebSocket Fails

Check nginx logs:

```bash
docker compose logs --tail=100 web
```

The nginx config forwards `Upgrade` and `Connection` headers for Colyseus WebSocket traffic.

### MySQL Data Disappeared

Check whether the volume was removed with `docker compose down -v`. Normal `docker compose down` keeps data.
