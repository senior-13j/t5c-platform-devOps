# T5C Documentation

This documentation describes the T5C project, the local containerized infrastructure, and the deployment workflow that was added around the game server.

## Documentation Index

- [Project Overview](./PROJECT.md)
- [Infrastructure and Deployment](./INFRASTRUCTURE_AND_DEPLOYMENT.md)

## Runtime URLs

The local Docker stack is designed to be used through domain names, not raw service ports:

| Surface | URL | Purpose |
| --- | --- | --- |
| Game | `https://arkadii.game.local` | Main client, API, and WebSocket entrypoint |
| Docs | `https://arkadii.game.local/docs` | Rendered project documentation |
| Grafana | `https://grafana.arkadii.game.local` | Dashboards and observability UI |
| Prometheus | `https://prometheus.arkadii.game.local` | Metrics target inspection and queries |

The backend service ports remain internal to Docker. Only the nginx HTTPS entrypoint is published on the host.

## Quick Start

```bash
scripts/setup-local-domain.sh
docker compose up -d --build
```

Open:

```text
https://arkadii.game.local
```

## Operational Status

The current stack includes:

- an nginx HTTPS reverse proxy with local TLS certificates;
- a Node.js production server image built from the TypeScript and Webpack outputs;
- a MySQL 8.4 database volume for persistent player data;
- Prometheus scraping the server `/metrics` endpoint;
- Grafana configured with a Prometheus datasource.

## Readiness Checks

Use these checks before committing or deploying changes:

```bash
npm run client-build
npm run server-build
docker compose config
docker compose up -d --build
curl -fsS https://arkadii.game.local/health
curl -fsS https://grafana.arkadii.game.local/api/health
curl -fsS https://prometheus.arkadii.game.local/-/healthy
npm run smoke:ws
```
