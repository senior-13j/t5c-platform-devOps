# Public Deployment

This guide describes how to run the game publicly at:

```text
https://arkadii.game
```

The public stack is separate from the local `arkadii.game.local` stack. Local development continues to use `docker-compose.yml` with nginx and local certificates. Public deployment uses `docker-compose.public.yml` with Caddy, automatic HTTPS, and public port bindings.

## Current DNS Status

At the time this deployment profile was added, `arkadii.game` did not resolve in DNS. The compose files are ready, but the public site will not work until DNS points to the deployment host.

## Public Architecture

```text
Internet
  |
  | https://arkadii.game
  | https://www.arkadii.game -> https://arkadii.game
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

The game server port, MySQL, Prometheus, and Grafana remain private inside the Docker network. The application `/metrics` endpoint is available publicly through `https://arkadii.game/metrics`.

## DNS Requirements

Create DNS records at the registrar or DNS provider:

| Host | Type | Value |
| --- | --- | --- |
| `arkadii.game` | `A` | public IPv4 address of the deployment host |
| `arkadii.game` | `AAAA` | public IPv6 address, only if the host has working IPv6 |
| `www.arkadii.game` | `CNAME` | `arkadii.game` |

If the host is behind a home router, forward TCP ports `80` and `443` from the router to the machine running Docker.

## Firewall Requirements

Allow inbound TCP:

```text
80
443
```

Do not open MySQL `3306`, server `3000`, Prometheus `9090`, or Grafana `3001` to the internet.

Ports `80` and `443` must be free on the deployment host before starting the public stack. Stop the local compose stack and any host-level reverse proxy that already owns those ports.

## Environment Setup

Create a public environment file:

```bash
cp .env.public.example .env.public
```

Edit `.env.public` and replace every `CHANGE_ME` value with a strong secret.

Important defaults:

| Variable | Public Default | Description |
| --- | --- | --- |
| `APP_DOMAIN` | `arkadii.game` | public game domain |
| `PUBLIC_BIND` | `0.0.0.0` | bind Caddy to all network interfaces |
| `HTTP_PORT` | `80` | public HTTP port used for redirects and ACME challenges |
| `HTTPS_PORT` | `443` | public HTTPS port |
| `DATABASE_PASSWORD` | required | MySQL application password |
| `MYSQL_ROOT_PASSWORD` | required | MySQL root password |
| `GRAFANA_ADMIN_PASSWORD` | required | Grafana admin password, even though Grafana is not publicly routed |

Leave `CLIENT_API_URL` and `CLIENT_WS_URL` empty for public deployment. The production client will use the current origin and `wss://arkadii.game`.

## Readiness Check

Run:

```bash
npm run check:public
```

Or specify another environment file:

```bash
scripts/check-public-readiness.sh .env.public
```

The check verifies whether `arkadii.game` has DNS records and whether they match the host public IPv4 address when it can be detected.

## Start the Public Stack

Stop the local stack if it is using port `443`:

```bash
docker compose down
```

If a host-level nginx service is running on port `80`, stop or disable it before starting Caddy:

```bash
sudo systemctl stop nginx
```

Start the public stack:

```bash
docker compose --env-file .env.public -f docker-compose.public.yml up -d --build
```

Caddy will request and renew Let's Encrypt certificates automatically. DNS must already point at this host and ports `80` and `443` must be reachable from the internet.

## Validate Public Access

Run these checks from the deployment host:

```bash
docker compose --env-file .env.public -f docker-compose.public.yml ps
curl -fsS https://arkadii.game/health
SMOKE_WS_URL=wss://arkadii.game npm run smoke:ws
```

Run this from another network, such as a phone on mobile data:

```text
https://arkadii.game
```

## Public Runtime Notes

- `https://arkadii.game` serves the game client, API, WebSocket endpoint, and `/docs`.
- `https://www.arkadii.game` redirects to `https://arkadii.game`.
- `/metrics` is public through the game domain.
- Prometheus and Grafana stay internal to Docker by default.
- MySQL data is stored in the `t5c-platform-public_mysql_data` Docker volume.

## Troubleshooting

### Caddy Cannot Issue Certificates

Check DNS and firewall first:

```bash
scripts/check-public-readiness.sh .env.public
docker compose --env-file .env.public -f docker-compose.public.yml logs --tail=100 caddy
```

Let's Encrypt must reach the host on port `80` or `443`.

### Domain Still Opens the Wrong Host

DNS propagation can take time. Check the authoritative DNS provider and compare:

```bash
dig +short arkadii.game A
curl -fsS https://api.ipify.org
```

### WebSocket Fails but HTTPS Works

Check the Caddy and server logs:

```bash
docker compose --env-file .env.public -f docker-compose.public.yml logs --tail=100 caddy server
```

Caddy forwards WebSocket upgrades automatically through `reverse_proxy`.
