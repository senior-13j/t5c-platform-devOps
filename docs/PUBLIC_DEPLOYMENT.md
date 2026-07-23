# Public Deployment

This guide describes how to run T5C publicly at:

```text
https://arkadii.world/game/
```

The public stack is separate from the local `arkadii.game.local` stack. Local
development uses `docker-compose.yml` with nginx and local certificates. Public
deployment uses `docker-compose.public.yml` with Caddy, automatic HTTPS, and
public `80`/`443` bindings.

## Preflight Checklist

| Requirement | Why It Matters |
| --- | --- |
| DNS for `arkadii.world` points to the deployment host | Let's Encrypt and browsers must reach the correct machine |
| TCP ports `80` and `443` are reachable from the internet | Caddy needs them for HTTP redirects, ACME challenges, and HTTPS traffic |
| `.env.public` exists with strong secrets | Public MySQL and Grafana passwords must not use defaults |
| Local stack is stopped if it owns port `443` | The public Caddy profile needs the host HTTPS port |
| Host firewall allows only the intended public ports | MySQL, Prometheus, Grafana, and the Node.js port should stay private |

## Public Architecture

```text
Internet
  |
  | https://arkadii.world/game/
  | https://www.arkadii.world/game/ -> https://arkadii.world/game/
  v
Caddy public proxy
  |
  +-- server:3000      Node.js, Express, Colyseus, static client, docs

server:3000
  |
  +-- mysql:3306       MySQL database
  +-- prometheus:9090  internal metrics scraping
  +-- grafana:3001     internal dashboard service
```

Only Caddy publishes host ports:

```text
0.0.0.0:80  -> caddy:80
0.0.0.0:443 -> caddy:443
```

The game server port, MySQL, Prometheus, and Grafana remain private inside the
Docker network. The game client, API, docs, and WebSocket endpoint are routed
through `/game/`.

## DNS Requirements

Create these records at the registrar or DNS provider:

| Host | Type | Value |
| --- | --- | --- |
| `arkadii.world` | `A` | Public IPv4 address of the deployment host |
| `arkadii.world` | `AAAA` | Public IPv6 address, only if the host has working IPv6 |
| `www.arkadii.world` | `CNAME` | `arkadii.world` |

If the host is behind a home router, forward TCP ports `80` and `443` from the
router to the machine running Docker.

## Firewall Requirements

Allow inbound TCP:

```text
80
443
```

Do not open these ports to the internet:

| Port | Service |
| --- | --- |
| `3000` | Node.js game server |
| `3306` | MySQL |
| `9090` | Prometheus |
| `3001` | Grafana |

## Environment Setup

Create the public environment file:

```bash
cp .env.public.example .env.public
```

Replace every `CHANGE_ME` value before starting the stack.

| Variable | Public Default | Description |
| --- | --- | --- |
| `APP_DOMAIN` | `arkadii.world` | Public apex domain |
| `APP_BASE_PATH` | `/game` | Public path routed by Caddy to the game server |
| `PUBLIC_BIND` | `0.0.0.0` | Host interface for public Caddy bindings |
| `HTTP_PORT` | `80` | Public HTTP port for redirects and ACME challenges |
| `HTTPS_PORT` | `443` | Public HTTPS port |
| `CLIENT_BASE_PATH` | `/game` | Browser base path baked into the game bundle |
| `DATABASE_PASSWORD` | required | MySQL application password |
| `MYSQL_ROOT_PASSWORD` | required | MySQL root password |
| `GRAFANA_ADMIN_PASSWORD` | required | Grafana admin password, even though Grafana is not publicly routed |

Leave `CLIENT_API_URL` and `CLIENT_WS_URL` empty for this public profile. The
production client will use the current origin plus `/game` and connect to
`wss://arkadii.world/game`.

## Readiness Check

Run:

```bash
npm run check:public
```

Or specify another environment file:

```bash
scripts/check-public-readiness.sh .env.public
```

The check reports:

- domain and game URL derived from `.env.public`;
- whether ports `80` or `443` are already listening locally;
- detected public IPv4 address when available;
- `A`, `AAAA`, and `www` DNS records;
- blocking DNS problems before Caddy attempts certificate issuance.

## Start the Public Stack

Stop the local stack if it is using port `443`:

```bash
docker compose down
```

Stop any host-level service that already owns public HTTP/HTTPS ports:

```bash
sudo systemctl stop nginx
```

Validate the public Compose profile:

```bash
docker compose --env-file .env.public -f docker-compose.public.yml config
```

Start the public stack:

```bash
docker compose --env-file .env.public -f docker-compose.public.yml up -d --build
```

Caddy will request and renew Let's Encrypt certificates automatically. DNS must
already point at this host and ports `80` and `443` must be reachable from the
internet.

## Validate Public Access

Run these checks from the deployment host:

```bash
docker compose --env-file .env.public -f docker-compose.public.yml ps
curl -fsS https://arkadii.world/health
SMOKE_WS_URL=wss://arkadii.world/game npm run smoke:ws
```

Run this from another network, such as a phone on mobile data:

```text
https://arkadii.world/game/
```

## Runtime Notes

| Surface | Public Behavior |
| --- | --- |
| Game | Served at `https://arkadii.world/game/` |
| Docs | Served under `https://arkadii.world/game/docs/` |
| `www` host | Redirects to `https://arkadii.world` |
| MySQL | Private Docker service with persistent volume |
| Prometheus | Internal Docker service |
| Grafana | Internal Docker service |
| Metrics endpoint | Exposed at `https://arkadii.world/metrics` by the current Caddy config |

The public MySQL volume is:

```text
t5c-platform-public_mysql_data
```

## Operations

| Task | Command |
| --- | --- |
| Start or update public stack | `docker compose --env-file .env.public -f docker-compose.public.yml up -d --build` |
| Stop public stack and keep data | `docker compose --env-file .env.public -f docker-compose.public.yml down` |
| Show Caddy logs | `docker compose --env-file .env.public -f docker-compose.public.yml logs --tail=100 caddy` |
| Show game server logs | `docker compose --env-file .env.public -f docker-compose.public.yml logs --tail=100 server` |
| Check DNS readiness again | `npm run check:public` |

## Security Notes

- Keep `.env.public` out of git.
- Rotate `DATABASE_PASSWORD`, `MYSQL_ROOT_PASSWORD`, and
  `GRAFANA_ADMIN_PASSWORD` before any shared or long-lived deployment.
- Do not publish MySQL, Prometheus, Grafana, or the raw Node.js server port.
- Treat `/metrics` as public unless the Caddy config is changed to restrict it.
- Add backups before depending on the public MySQL volume for persistent data.

## Troubleshooting

### Caddy Cannot Issue Certificates

Check DNS and firewall first:

```bash
scripts/check-public-readiness.sh .env.public
docker compose --env-file .env.public -f docker-compose.public.yml logs --tail=100 caddy
```

Let's Encrypt must reach the host on port `80` or `443`.

### Domain Still Opens the Wrong Host

DNS propagation can take time. Compare DNS with the host public IP:

```bash
dig +short arkadii.world A
curl -fsS https://api.ipify.org
```

### HTTPS Works but WebSocket Fails

Check Caddy and server logs:

```bash
docker compose --env-file .env.public -f docker-compose.public.yml logs --tail=100 caddy server
```

Caddy forwards WebSocket upgrades automatically through `reverse_proxy`.

### Public Stack Starts but Game Assets 404

Verify that the public build uses the same base path as Caddy:

```env
APP_BASE_PATH=/game
CLIENT_BASE_PATH=/game
```

Then rebuild the server image:

```bash
docker compose --env-file .env.public -f docker-compose.public.yml up -d --build server caddy
```
