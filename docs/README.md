# T5C Documentation

This documentation covers the T5C game runtime, local Docker infrastructure, and
public deployment workflow.

## Start Here

| Need | Read |
| --- | --- |
| Understand how the game is structured | [Project Overview](./PROJECT.md) |
| Run the complete stack locally | [Infrastructure and Deployment](./INFRASTRUCTURE_AND_DEPLOYMENT.md) |
| Publish the game on `arkadii.world` | [Public Deployment](./PUBLIC_DEPLOYMENT.md) |

## Runtime Map

The local Docker stack is designed around friendly HTTPS domains instead of raw
service ports.

| Surface | URL | Purpose |
| --- | --- | --- |
| Game | `https://arkadii.game.local` | Main client, API, and WebSocket entrypoint |
| Docs | `https://arkadii.game.local/docs` | Rendered project documentation |
| Grafana | `https://grafana.arkadii.game.local` | Dashboards and observability UI |
| Prometheus | `https://prometheus.arkadii.game.local` | Metrics target inspection and queries |
| Public Game | `https://arkadii.world/game/` | Public deployment target after DNS points to the host |

Only the reverse proxy publishes host ports. The Node.js server, MySQL,
Prometheus, and Grafana remain internal Docker services.

## Local Quick Start

```bash
cp .env.example .env
scripts/setup-local-domain.sh
docker compose up -d --build
```

Open the game:

```text
https://arkadii.game.local
```

## Public Quick Start

```bash
cp .env.public.example .env.public
npm run check:public
docker compose --env-file .env.public -f docker-compose.public.yml up -d --build
```

Replace the `CHANGE_ME` values in `.env.public` before starting the public
stack.

## Operational Checklist

Use these commands before committing infrastructure or deployment changes.

| Command | Purpose |
| --- | --- |
| `npm run client-build` | Validate the production browser bundle and docs copy step |
| `npm run server-build` | Validate the TypeScript server build |
| `docker compose config` | Validate local Compose interpolation and service wiring |
| `docker compose --env-file .env.public -f docker-compose.public.yml config` | Validate the public Compose profile |
| `npm run smoke:ws` | Verify Colyseus WebSocket access through the local HTTPS domain |

## Readiness Checks

After the stack is running, check the main surfaces:

```bash
curl -fsS https://arkadii.game.local/health
curl -fsS https://grafana.arkadii.game.local/api/health
curl -fsS https://prometheus.arkadii.game.local/-/healthy
npm run smoke:ws
```

## Document Set

| File | Scope |
| --- | --- |
| [PROJECT.md](./PROJECT.md) | Codebase shape, runtime responsibilities, persistence, and build outputs |
| [INFRASTRUCTURE_AND_DEPLOYMENT.md](./INFRASTRUCTURE_AND_DEPLOYMENT.md) | Local compose stack, TLS setup, validation, observability, operations, and troubleshooting |
| [PUBLIC_DEPLOYMENT.md](./PUBLIC_DEPLOYMENT.md) | Public DNS, Caddy, required secrets, startup commands, validation, and troubleshooting |
