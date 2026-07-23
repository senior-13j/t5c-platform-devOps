# Project Overview

T5C, The 5th Continent, is a multiplayer 3D top-down RPG built with Babylon.js, Colyseus, Express, TypeScript, and SQL persistence.

## Application Shape

The application is split into three main runtime areas:

| Area | Main Paths | Responsibility |
| --- | --- | --- |
| Client | `src/client`, `public` | Babylon.js game client, screens, UI, assets, networking |
| Shared | `src/shared` | shared config, types, utility classes, game math helpers |
| Server | `src/server` | Express API, Colyseus rooms, game state, persistence |

The Docker deployment builds the client bundle into `dist/client` and the server into `dist/server`. The Node.js server serves the built client, REST API, Colyseus matchmaker, WebSocket traffic, health checks, metrics, and docs through one process.

## Game Runtime

The browser loads the client from the public HTTPS domain:

```text
https://arkadii.game.local
```

The client uses same-origin URLs in production:

- HTTP API calls use `window.location.origin` plus the configured `CLIENT_BASE_PATH`;
- Colyseus WebSocket connections use `wss://` with the current host plus the configured `CLIENT_BASE_PATH`;
- optional `CLIENT_API_URL` and `CLIENT_WS_URL` build-time variables can override those URLs.

This keeps the browser-facing surface stable behind nginx and avoids exposing the Node server port directly.

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

The server listens on internal port `3000` inside Docker. It is not published to the host.

## Persistence

The project supports both SQLite and MySQL in code, but the containerized deployment uses MySQL by default:

```env
APP_DATABASE=mysql
DATABASE_HOST=mysql
DATABASE_DB=t5c
DATABASE_USER=t5c
DATABASE_PASSWORD=t5c_password
```

The schema bootstrap is guarded. If the expected schema already exists, the server skips importing `database/mysql.sql` so persistent volume data is not dropped on restart.

## Important Scripts

| Command | Purpose |
| --- | --- |
| `npm run client-dev` | Run Webpack dev server for local client development |
| `npm run server-dev` | Run the TypeScript server with reload/debug tooling |
| `npm run client-build` | Build the production client bundle and copy static assets/docs |
| `npm run server-build` | Compile the server and copy public assets |
| `scripts/setup-local-domain.sh` | Prepare local HTTPS domains and certificates |
| `docker compose up -d --build` | Build and run the full local container stack |

## Repository Documentation

The Markdown source for project documentation lives in `docs/`. The served `/docs` UI renders those files from:

```text
/docs/content/*.md
```

Webpack copies `docs/` into the client output during `npm run client-build`.
