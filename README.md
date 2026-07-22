# T5C - The 5th Continent
Building a basic multiplayer 3d top down rpg using babylon.js and colyseus

![Screenshot of T5c showing a mythical knight in a green lust forest.](https://us1.discourse-cdn.com/flex024/uploads/babylonjs/original/3X/7/3/730ef766396a083a3e3f97c0af46c443b4eba22b.jpeg)
![Screen of Eldoria, the imaginary land of T5C](https://github.com/user-attachments/assets/36710dd5-180b-4395-85db-7f98bfd6e08c)

## Current progress:
- vat animations and instances
- fully player authorative movement with client side prediction and server reconciliation
  - diablo like movement using the mouse with the ability to click to move
- scene management (login, register, character selection, etc...)
- map management (ability to teleport to a different map (ex: a dungeon) )
- multiplayer animated characters
- global chat (works accross zones)
- uses a navmesh for collision detection
- player data can be saved with mysql lite / mysql
- basic enemies with simple AI behaviour (IDLE, PATROL, CHASE, ATTACK, DEAD)
- enemies can drop items (based on a loot table)
- 4 basic abilities ( sword attack, fireball, dot, heal )
- ability to target players and enemies
- ability to pick up items and see them in your inventory
- ability to equip items and see them on your character
- basic player levelling with experience and ability points
- fully functional UI (experience bar, abilities bar, draggable panels, etc...)
- simple quest system
- simple trainer system (learn abilities)
- simple vendor system (buy and sell)

## Links
Follow the progress on the official babylon.js forum: [https://forum.babylonjs.com/t/multiplayer-top-down-rpg-babylon-js-colyseus/35733](https://forum.babylonjs.com/t/multiplayer-top-down-rpg-babylon-js-colyseus/35733)

Check out my devlogs on [https://dev.to/orion3d](https://dev.to/orion3d)

## Requirements
- Download and install [Node.js LTS](https://nodejs.org/en/download/)
- Install Docker with Docker Compose support for the containerized local stack.
- Clone or download this repository.
- Run `npm install`

## Technology
- Babylon.js 6.x.x [https://www.babylonjs.com/](https://www.babylonjs.com/)
- Colyseus 0.15.x [https://colyseus.io/](https://colyseus.io/)
- MySQL 8.x for the Docker Compose stack.
- SQLite 3.x.x remains available for non-Docker local development.

## How to run without Docker
- Run `npm run server-dev` to launch the server
- Run `npm run client-dev` to launch the client

> The client should be accessible at [`http://localhost:8080`](http://localhost:8080)

> The server should be available locally at [http://localhost:3000](http://localhost:3000)

> The Colyseus monitor should be available at [http://localhost:3000/monitor](http://localhost:3000/monitor)

## Docker Compose
- Copy `.env.example` to `.env` if you need to reset local Docker settings.
- Run `scripts/setup-local-domain.sh` once to create local DNS entries and a trusted local TLS certificate.
- Run `docker compose up -d --build`.
- Open [`https://arkadii.game.local`](https://arkadii.game.local).

The compose stack uses MySQL by default. Only the nginx HTTPS entrypoint is published to localhost as `127.0.0.1:${HTTPS_PORT:-443}:443`; the game server `3000`, MySQL `3306`, Prometheus `9090`, and Grafana `3001` stay inside the Docker network. Grafana and Prometheus are available through nginx at `https://grafana.arkadii.game.local` and `https://prometheus.arkadii.game.local`.

## Public Deployment
- Point DNS for `arkadii.game` to the deployment host.
- Copy `.env.public.example` to `.env.public` and replace every `CHANGE_ME` secret.
- Run `npm run check:public` to verify DNS readiness.
- Stop the local compose stack and any host service already using ports `80` or `443`.
- Run `docker compose --env-file .env.public -f docker-compose.public.yml up -d --build`.
- Open [`https://arkadii.game`](https://arkadii.game).

The public profile uses Caddy for automatic Let's Encrypt HTTPS, publishes only ports `80` and `443`, and keeps MySQL, Prometheus, and Grafana private inside Docker. The app `/metrics` endpoint remains public through the game domain.

Before committing infrastructure changes, run:

```bash
npm run client-build
npm run server-build
docker compose config
docker compose up -d --build
npm run smoke:ws
```

## Documentation
- Repository documentation lives in [`docs/`](docs/README.md).
- The running Docker stack serves the same documentation at [`https://arkadii.game.local/docs`](https://arkadii.game.local/docs).
- Infrastructure and deployment details are in [`docs/INFRASTRUCTURE_AND_DEPLOYMENT.md`](docs/INFRASTRUCTURE_AND_DEPLOYMENT.md).
- Public deployment details are in [`docs/PUBLIC_DEPLOYMENT.md`](docs/PUBLIC_DEPLOYMENT.md).

## Smoke and Load Testing
- Run `npm run smoke:ws` to verify the local HTTPS/WSS route through `https://arkadii.game.local`.
- Run `npm run loadtest` for an interactive Colyseus chat room load test over `wss://arkadii.game.local`.
