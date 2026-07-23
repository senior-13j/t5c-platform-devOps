# T5C - The 5th Continent

T5C is a multiplayer 3D top-down RPG prototype built with Babylon.js, Colyseus,
Express, TypeScript, and SQL persistence. The repository includes the original
game client/server plus a containerized local stack, observability services, and
a public deployment profile for `https://arkadii.world/game/`. The browser shell
also includes responsive game UI, native login controls, accessible loading and
failure states, and search/discovery metadata.

![Screenshot of T5C showing a mythical knight in a green lush forest.](https://us1.discourse-cdn.com/flex024/uploads/babylonjs/original/3X/7/3/730ef766396a083a3e3f97c0af46c443b4eba22b.jpeg)
![Screen of Eldoria, the imaginary land of T5C](https://github.com/user-attachments/assets/36710dd5-180b-4395-85db-7f98bfd6e08c)

## Project at a Glance

| Area | Stack | Notes |
| --- | --- | --- |
| Client | Babylon.js, TypeScript, Webpack | 3D game client, responsive UI, native login shell, assets, networking |
| Server | Node.js, Express, Colyseus | REST API, WebSocket rooms, compressed static delivery, health checks, metrics |
| Data | MySQL, SQLite fallback | Docker uses MySQL; non-Docker development can still use SQLite |
| Infrastructure | Docker Compose, nginx, Caddy, Prometheus, Grafana | Local HTTPS stack and public deployment profile |

## Current Gameplay

- VAT animations and instanced animated characters.
- Player-authoritative click-to-move controls with client-side prediction and server reconciliation.
- Scene flow for native login, Quick Play, character selection, and character creation.
- Map transitions, including teleporting to dungeon-style areas.
- Global chat across zones.
- Navmesh-based collision detection.
- Persistent player data with SQLite or MySQL.
- Enemy AI states: `IDLE`, `PATROL`, `CHASE`, `ATTACK`, and `DEAD`.
- Loot drops driven by loot tables.
- Four starter abilities: sword attack, fireball, damage-over-time, and heal.
- Targeting for players and enemies.
- Item pickup, inventory management, equipment, and visible character gear.
- Player leveling with experience and ability points.
- Functional RPG UI: experience bar, ability bar, draggable panels, inventory, quests, help, and character panels.
- Simple quest, trainer, vendor, buy, and sell systems.
- Responsive mobile HUD with compact chat, hotbar, menu, status bars, and panels.
- Actionable loading and WebGL failure states instead of an indefinite loading screen.

## Web Quality

- Native labeled login controls with keyboard focus, validation, and live status.
- Semantic HTML shell with language, main and heading landmarks, skip navigation,
  canvas instructions, reduced-motion support, and screen-reader announcements.
- Canonical metadata, Open Graph/Twitter cards, `VideoGame` JSON-LD, a web app
  manifest, and crawler/answer-engine discovery files.
- Runtime asset deduplication, mobile render scaling, mobile shadow reduction,
  gzip compression, and explicit cache policy.
- `scrypt` password hashing with automatic migration of valid legacy plaintext
  credentials; authentication responses never include password data.

The latest measured Lighthouse result is **80 Performance / 100 Accessibility /
100 Best Practices / 100 SEO**. See the
[Game Quality Audit](docs/GAME_QUALITY_AUDIT.md) for the test matrix, baseline,
asset review, and remaining risks.

## Requirements

- Node.js 22, matching [`.nvmrc`](.nvmrc).
- npm, installed with Node.js.
- Docker with Docker Compose support for the containerized stack.
- `openssl` and `sudo` for the local HTTPS domain setup script.

Install dependencies once:

```bash
npm install
```

## Quick Start with Docker

The Docker Compose stack is the recommended way to run the complete local
environment: game server, MySQL, nginx HTTPS proxy, Prometheus, and Grafana.

```bash
cp .env.example .env
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

Only nginx publishes a host port: `127.0.0.1:${HTTPS_PORT:-443}:443`. The game
server, MySQL, Prometheus, and Grafana stay private inside the Docker network.

## Local Development without Docker

Use this mode when you want Webpack hot reload and the TypeScript server running
directly on the host.

Start these in separate terminals:

```bash
APP_DATABASE=sqllite npm run server-dev
```

```bash
npm run client-dev
```

`sqllite` is the existing configuration key used by the non-MySQL adapter.
The Webpack dev client opens the game scene directly; the built client served by
port `3000` starts at the production login screen.

The default local URLs are:

| Surface | URL |
| --- | --- |
| Client dev server | `http://localhost:8080` |
| API and game server | `http://localhost:3000` |
| Colyseus monitor | `http://localhost:3000/monitor` |

## Useful Commands

| Command | Purpose |
| --- | --- |
| `npm run client-build` | Build the production browser bundle into `dist/client` |
| `npm run server-build` | Compile the TypeScript server and copy public assets |
| `npm run check:web-quality` | Validate metadata, structured data, manifest, crawler files, and local references |
| `npx tsc --noEmit` | Type-check the complete client/server source tree without writing output |
| `npm audit --omit=dev` | Review vulnerabilities in the production dependency tree |
| `docker compose config` | Validate the local Compose file after env interpolation |
| `docker compose up -d --build` | Build and run the complete local stack |
| `npm run smoke:ws` | Join the default Colyseus room through local HTTPS/WSS |
| `npm run loadtest` | Run an interactive Colyseus chat load test |
| `npm run check:public` | Check DNS and port readiness for the public deployment |

## Public Deployment

The public profile serves the game at `https://arkadii.world/game/` through
Caddy with automatic Let's Encrypt certificates.

```bash
cp .env.public.example .env.public
npm run check:public
docker compose --env-file .env.public -f docker-compose.public.yml up -d --build
```

Replace every `CHANGE_ME` value in `.env.public` before starting the public
stack. Caddy publishes only ports `80` and `443`; MySQL, Prometheus, and Grafana
remain private inside Docker.

Public discovery endpoints are served at the domain root while the game remains
under `/game/`:

| Endpoint | Purpose |
| --- | --- |
| `https://arkadii.world/robots.txt` | Crawler policy and sitemap location |
| `https://arkadii.world/sitemap.xml` | Canonical game and documentation URLs |
| `https://arkadii.world/llms.txt` | Concise answer-engine project description |
| `https://arkadii.world/game/manifest.webmanifest` | Browser app metadata |

## Documentation

| Document | What it covers |
| --- | --- |
| [`docs/README.md`](docs/README.md) | Documentation index and runtime URL map |
| [`docs/PROJECT.md`](docs/PROJECT.md) | Project architecture, runtime shape, persistence, and scripts |
| [`docs/API_AND_SECURITY.md`](docs/API_AND_SECURITY.md) | REST endpoints, authentication, password migration, delivery policy, and security boundaries |
| [`docs/GAME_QUALITY_AUDIT.md`](docs/GAME_QUALITY_AUDIT.md) | UX, visual, accessibility, SEO/AEO, asset, performance, and dependency audit |
| [`docs/INFRASTRUCTURE_AND_DEPLOYMENT.md`](docs/INFRASTRUCTURE_AND_DEPLOYMENT.md) | Local Docker stack, TLS, validation, observability, and troubleshooting |
| [`docs/PUBLIC_DEPLOYMENT.md`](docs/PUBLIC_DEPLOYMENT.md) | DNS, public Caddy profile, secrets, startup, and production checks |

The running Docker stack serves the same documentation at:

```text
https://arkadii.game.local/docs
```

## Links

- Babylon.js forum thread: <https://forum.babylonjs.com/t/multiplayer-top-down-rpg-babylon-js-colyseus/35733>
- Devlogs: <https://dev.to/orion3d>
