# T5C Documentation

This documentation covers the T5C game runtime, bilingual player experience,
keyboard/mouse and touch controls, quality verification, local Docker
infrastructure, and public deployment workflow.

## Start Here

| Need | Read |
| --- | --- |
| Understand how the game is structured | [Project Overview](./PROJECT.md) |
| Understand languages, keyboard/mouse, touch, and their QA | [Localization and Controls](./LOCALIZATION_AND_CONTROLS.md) |
| Integrate with or secure the HTTP API | [API and Security](./API_AND_SECURITY.md) |
| Review UX, accessibility, SEO, assets, and quality results | [Game Quality Audit](./GAME_QUALITY_AUDIT.md) |
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
| Public Docs | `https://arkadii.world/game/docs/` | Served copy of this document set |
| Discovery | `https://arkadii.world/robots.txt` | Root crawler policy linking the public sitemap |

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
| `npm run check:localization` | Validate English/Russian catalogs, placeholders, active content, dialogs, and bindings |
| `npm run check:web-quality` | Validate semantic metadata and discovery files |
| `npm run test:e2e` | Run the desktop keyboard/mouse and mobile touch WebGL flows |
| `npx tsc --noEmit` | Type-check client and server without generating output |
| `npm audit --omit=dev` | Audit production dependencies |
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

For a public deployment, also verify the discovery surface:

```bash
curl -fsS https://arkadii.world/robots.txt
curl -fsS https://arkadii.world/sitemap.xml
curl -fsS https://arkadii.world/llms.txt
```

## Document Set

| File | Scope |
| --- | --- |
| [PROJECT.md](./PROJECT.md) | Codebase shape, runtime responsibilities, persistence, and build outputs |
| [LOCALIZATION_AND_CONTROLS.md](./LOCALIZATION_AND_CONTROLS.md) | Entry preferences, translation architecture, complete controls, accessibility, E2E coverage, and patch notes |
| [API_AND_SECURITY.md](./API_AND_SECURITY.md) | Supported API flows, request formats, authentication storage, delivery headers, and known boundaries |
| [GAME_QUALITY_AUDIT.md](./GAME_QUALITY_AUDIT.md) | Visual QA, accessibility, SEO/AEO, assets, performance, and dependency findings |
| [INFRASTRUCTURE_AND_DEPLOYMENT.md](./INFRASTRUCTURE_AND_DEPLOYMENT.md) | Local compose stack, TLS setup, validation, observability, operations, and troubleshooting |
| [PUBLIC_DEPLOYMENT.md](./PUBLIC_DEPLOYMENT.md) | Public DNS, Caddy, required secrets, startup commands, validation, and troubleshooting |
