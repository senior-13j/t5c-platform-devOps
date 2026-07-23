# Project Overview

T5C, The 5th Continent, is a multiplayer 3D top-down RPG prototype built with
Babylon.js, Colyseus, Express, TypeScript, and SQL persistence.

## Runtime Shape

The application has one browser client and one Node.js runtime service. In the
Docker profiles, the Node.js service serves the built client, REST API,
Colyseus WebSocket rooms, health checks, Prometheus metrics, and rendered docs.

```text
Browser
  |
  | HTTPS + WSS
  v
reverse proxy
  |
  v
server:3000
  |
  +-- Express API
  +-- Colyseus rooms
  +-- static client and docs
  +-- /health
  +-- /metrics
  |
  v
mysql:3306
```

## Source Areas

| Area | Main Paths | Responsibility |
| --- | --- | --- |
| Client | `src/client`, `public` | Babylon.js game client, screens, UI, assets, networking |
| Shared | `src/shared` | Config, types, utility classes, game math helpers |
| Server | `src/server` | Express API, Colyseus rooms, game state, persistence |
| Data | `database` | MySQL and SQLite schema files |
| Infrastructure | `Dockerfile`, `docker-compose*.yml`, `docker` | Local and public container profiles |
| Documentation | `README.md`, `docs`, `public/docs` | Repository docs and served docs UI |

## Build Output

The production build creates two runtime outputs:

| Output | Created By | Contents |
| --- | --- | --- |
| `dist/client` | `npm run client-build` | Webpack bundle, public assets, and copied docs content |
| `dist/server` | `npm run server-build` | Compiled TypeScript server and copied public assets |

The Dockerfile builds both outputs, prunes development dependencies, and runs:

```bash
node dist/server/server/index.js
```

## Game Runtime

In the local Docker stack, the browser loads the game from:

```text
https://arkadii.game.local
```

In the public deployment profile, the browser loads the game from:

```text
https://arkadii.world/game/
```

Production client URL resolution is same-origin by default:

| Setting | Default Behavior |
| --- | --- |
| `CLIENT_API_URL` empty | API calls use `window.location.origin` plus `CLIENT_BASE_PATH` |
| `CLIENT_WS_URL` empty | Colyseus connects with `wss://` and the current host plus `CLIENT_BASE_PATH` |
| `CLIENT_BASE_PATH` empty | Local Docker serves from `/` |
| `CLIENT_BASE_PATH=/game` | Public Docker serves from `/game` |

This keeps browser-facing URLs stable behind nginx or Caddy and avoids exposing
the raw Node.js server port.

## Server Runtime

The server process starts:

- the MySQL-backed database adapter;
- the Express API;
- the Colyseus game server;
- `game_room` and `chat_room`;
- static file serving from `dist/client`;
- `/health` for container health checks;
- `/metrics` for Prometheus scraping;
- `/docs` for rendered project documentation.

The server listens on internal port `3000` inside Docker. It is not published to
the host directly.

## Persistence

The project supports both SQLite and MySQL in code. The Docker profiles use
MySQL by default.

```env
APP_DATABASE=mysql
DATABASE_HOST=mysql
DATABASE_DB=t5c
DATABASE_USER=t5c
DATABASE_PASSWORD=t5c_password
```

The schema bootstrap is guarded. If the expected schema already exists, the
server skips importing `database/mysql.sql` so persistent volume data is not
dropped on restart.

## Important Scripts

| Command | Purpose |
| --- | --- |
| `npm run client-dev` | Run Webpack dev server for local client development |
| `npm run server-dev` | Run the TypeScript server with reload/debug tooling |
| `npm run client-build` | Build the production client bundle and copy static assets/docs |
| `npm run server-build` | Compile the server and copy public assets |
| `npm run smoke:ws` | Join the default Colyseus room through local HTTPS/WSS |
| `npm run loadtest` | Run the Colyseus chat-room load test |
| `npm run check:public` | Check DNS and host readiness for `arkadii.world` |
| `scripts/setup-local-domain.sh` | Prepare local HTTPS domains and certificates |
| `docker compose up -d --build` | Build and run the full local container stack |

## Repository Documentation

The Markdown source for project documentation lives in `docs/`. Webpack copies
those files into the served docs content directory:

```text
/docs/content/*.md
```

The browser docs shell lives in `public/docs` and fetches Markdown from that
copied content directory at runtime.
