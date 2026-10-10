# Public Deployment

This guide describes how to run Arkadii Quest publicly at:

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
| GitHub `production` environment contains deploy secrets | CI can deploy after a successful `main` verification run |
| Local stack is stopped if it owns port `443` | The public Caddy profile needs the host HTTPS port |
| Host firewall allows only the intended public ports | MySQL, Prometheus, Grafana, and the Node.js port should stay private |
| Database backup is verified | Existing plaintext credentials migrate to `scrypt` after successful login |
| Asset provenance has been reviewed | Public release must have a source/license record for shipped models, textures, audio, and fonts |
| Localization, onboarding, automatic camera, and both input profiles pass QA | Public users must be able to learn the controls, enter, move, act, chat, and manage panels in English/Russian on desktop and touch devices |

## Public Architecture

```text
Internet
  |
  | https://arkadii.world/game/
  | https://arkadii.world/robots.txt
  | https://arkadii.world/sitemap.xml
  | https://arkadii.world/llms.txt
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

Only Caddy publishes internet-facing host ports:

```text
0.0.0.0:80  -> caddy:80
0.0.0.0:443 -> caddy:443
```

The game server port and MySQL remain private inside the Docker network.
Prometheus and Grafana are bound only to `127.0.0.1` on the server, so they are
available through SSH tunnels without being exposed on the public internet. The
game client, API, docs, and WebSocket endpoint are routed through `/game/`.
Crawler and answer-engine discovery files are routed at the domain root because
crawlers conventionally request them there.

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

Create the public environment file. In PowerShell:

```powershell
Copy-Item .env.public.example .env.public
```

In Bash:

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
| `PROMETHEUS_PORT` | `9090` | Loopback-only Prometheus port for SSH tunnels |
| `GRAFANA_PORT` | `3001` | Loopback-only Grafana port for SSH tunnels |
| `CLIENT_BASE_PATH` | `/game` | Browser base path baked into the game bundle |
| `CORS_ALLOWED_ORIGINS` | `https://arkadii.world,https://www.arkadii.world` | Exact browser origins allowed for HTTP CORS and WebSocket upgrades |
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

```text
npm run check:public -- --env-file .env.public
```

The Node.js command above works from PowerShell, cmd.exe, Bash, and CI. Native
wrappers are also available: `.\scripts\check-public-readiness.ps1 -EnvFile .env.public`
on Windows and `scripts/check-public-readiness.sh .env.public` on Linux/macOS.
See [Cross-Platform Operations](./CROSS_PLATFORM.md) for equivalent commands.

The check reports:

- domain and game URL derived from `.env.public`;
- whether ports `80` or `443` are already listening locally;
- detected public IPv4 address when available;
- `A`, `AAAA`, and `www` DNS records;
- blocking DNS problems before Caddy attempts certificate issuance.

## CI/CD: GitHub Actions to OVH

`.github/workflows/ci-cd.yml` replaces the obsolete cloud-deployment workflow. It
runs for every pull request to `main` and every push to `main`:

1. installs the locked Node.js dependencies and Playwright Chromium;
2. runs unit/integration, localization, web-quality, type, production-build,
   browser E2E, production dependency audit, Docker Compose, Caddy, and Docker
   image checks;
3. only for a successful `main` run, uploads an immutable source release to
   OVH, validates its Compose/Caddy configuration, builds the public stack,
   checks `health`, branded public metrics, and the Prometheus scrape target;
4. restores the previous release automatically when startup or verification
   fails.

The verification job runs on both `ubuntu-latest` and `windows-latest`.
Docker/Caddy image checks run on Linux, where the deployment image is built.

Deployments are serialized: a second production deploy waits for the first one
instead of interrupting it. Pull-request runs may be cancelled when superseded
by a newer commit.

### One-time OVH bootstrap

The deployment host must run supported Ubuntu. Connect with an administrator
account and run this once from a checked-out release:

```bash
sudo bash scripts/deploy/bootstrap-ovh.sh
```

From Windows PowerShell, run the same remote bootstrap through OpenSSH:

```powershell
.\scripts\deploy\bootstrap-ovh.ps1 -Host YOUR_OVH_HOST -IdentityFile "$HOME\.ssh\arkadii-quest-admin" -KnownHostsFile "$HOME\.ssh\known_hosts"
```

The bootstrap installs Docker Engine plus the Compose plugin from Docker's
Ubuntu repository, creates the `arkadii` deploy user, prepares
`/srv/arkadii-quest/{releases,shared}`, and enables UFW rules for SSH, HTTP,
and HTTPS. It does not open MySQL, Prometheus, Grafana, or the game-server port.

Create a dedicated deploy key locally, add its public half to
`/home/arkadii/.ssh/authorized_keys` on OVH, and keep the private half only in
GitHub Secrets:

```bash
ssh-keygen -t ed25519 -f ~/.ssh/arkadii-quest-github-deploy -C arkadii-quest-github-actions
ssh-copy-id -i ~/.ssh/arkadii-quest-github-deploy.pub arkadii@YOUR_OVH_HOST
```

From Windows PowerShell, create and install the same key after independently
verifying the OVH host key:

```powershell
ssh-keygen -t ed25519 -f "$HOME\.ssh\arkadii-quest-github-deploy" -C arkadii-quest-github-actions
Get-Content "$HOME\.ssh\arkadii-quest-github-deploy.pub" | ssh arkadii@YOUR_OVH_HOST 'umask 077; mkdir -p ~/.ssh; cat >> ~/.ssh/authorized_keys; chmod 700 ~/.ssh; chmod 600 ~/.ssh/authorized_keys'
```

If `ssh-copy-id` is unavailable, append the contents of the `.pub` file to the
deploy user's `~/.ssh/authorized_keys` with mode `600` and its `.ssh` directory
with mode `700`.

### GitHub production environment

Create a GitHub Environment named `production` for this repository. Restrict
its deployment branch to `main`. Do not add required reviewers if a push to
`main` must deploy unattended. Add these **environment secrets**:

| Secret | Value |
| --- | --- |
| `OVH_HOST` | OVH hostname or IPv4 address |
| `OVH_SSH_USER` | `arkadii`, unless the bootstrap was deliberately customized |
| `OVH_SSH_PORT` | SSH port, usually `22` |
| `OVH_SSH_PRIVATE_KEY` | Private content of `~/.ssh/arkadii-quest-github-deploy` |
| `OVH_SSH_KNOWN_HOSTS` | Verified `known_hosts` line for the OVH host and port |
| `OVH_PUBLIC_ENV_BASE64` | Base64 representation of the complete, non-placeholder `.env.public` |

Verify the OVH SSH host fingerprint in the OVH control panel or an existing
trusted session before saving `OVH_SSH_KNOWN_HOSTS`; do not rely on an
unverified `ssh-keyscan` result. The workflow enables strict host-key checking
and will fail instead of trusting a changed host key.

From PowerShell, create the environment-file secret without displaying it:

```powershell
$envBytes = [Text.Encoding]::UTF8.GetBytes((Get-Content .env.public -Raw))
[Convert]::ToBase64String($envBytes) | gh secret set --env production OVH_PUBLIC_ENV_BASE64
```

Base64 here is only a transport format. GitHub encrypts the secret at rest; the
workflow never writes it to the repository or action log. Add the other values
with `gh secret set --env production SECRET_NAME` or in the GitHub Environment
Secrets UI. GitHub Actions environments delay access to their secrets until any
environment protection rules have passed, and the `production` job records the
deployment URL in the repository history. See GitHub's documentation for
[environments](https://docs.github.com/en/actions/concepts/workflows-and-actions/deployment-environments),
[secrets](https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets),
and [deployment concurrency](https://docs.github.com/en/actions/concepts/workflows-and-actions/concurrency).

The first successful push to `main` creates a release under
`/srv/arkadii-quest/releases/` and atomically updates the `current` symlink.
Database, Prometheus, Grafana, and Caddy data remain in named Docker volumes,
outside release directories.

## Start the Public Stack Manually

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

Validate the Caddyfile against the same image used by Compose:

```bash
docker run --rm \
  -v "$PWD/docker/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" \
  caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile
```

On Windows, use the PowerShell Docker-volume syntax in
[Cross-Platform Operations](./CROSS_PLATFORM.md#public-readiness-and-local-validation).

Validate application metadata and production builds before creating the image:

```bash
npm test
npm run check:localization
npm run check:web-quality
npx tsc --noEmit
npm run client-build
npm run server-build
npm run test:e2e
npm audit
npm audit --omit=dev
```

Install a compatible browser with `npx playwright install chromium`. The
build and test commands above also run unchanged from PowerShell, cmd.exe,
and Bash; only the public server-management commands below must run on the
Ubuntu host (directly, through SSH, or through GitHub Actions).

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
npm run smoke:ws -- --endpoint wss://arkadii.world/game --token <account-token> --character-id <owned-character-id>
```

Verify search, answer-engine, manifest, compression, and cache delivery:

```bash
curl -fsS https://arkadii.world/robots.txt
curl -fsS https://arkadii.world/sitemap.xml
curl -fsS https://arkadii.world/llms.txt
curl -I https://arkadii.world/game/manifest.webmanifest
curl -sS -D - -o /dev/null \
  -H 'Accept-Encoding: gzip' \
  https://arkadii.world/game/js/bundle.js
```

Expected results:

- discovery files return `200` at the domain root;
- the sitemap contains `https://arkadii.world/game/` and the docs URL;
- the entry dialog allows English/Russian and keyboard/mouse/touch selection;
- the delivered `VideoGame` JSON-LD declares both `en` and `ru`;
- the manifest and entry HTML revalidate instead of receiving a long immutable
  cache lifetime;
- the bundle is compressed and does not expose `X-Powered-By`;
- authenticated WebSocket smoke testing can join through `/game`;
- a browser WebSocket upgrade from an origin outside
  `CORS_ALLOWED_ORIGINS` receives `403`.

Run this from another network, such as a phone on mobile data:

```text
https://arkadii.world/game/
```

## Runtime Notes

| Surface | Public Behavior |
| --- | --- |
| Game | Served at `https://arkadii.world/game/` |
| Docs | Served under `https://arkadii.world/game/docs/` |
| Manifest | Served at `https://arkadii.world/game/manifest.webmanifest` |
| Crawler policy | Served at `https://arkadii.world/robots.txt` |
| Sitemap | Served at `https://arkadii.world/sitemap.xml` |
| Answer-engine summary | Served at `https://arkadii.world/llms.txt` |
| `www` host | Redirects to `https://arkadii.world` |
| MySQL | Private Docker service with persistent volume |
| Prometheus | Loopback-only `127.0.0.1:9090` Docker service, available through SSH tunnel |
| Grafana | Loopback-only `127.0.0.1:3001` dashboard service, available through SSH tunnel |
| Metrics endpoint | Exposed at `https://arkadii.world/metrics` by the current Caddy config |

The public MySQL volume is:

```text
arkadii-quest-public_mysql_data
```

The public profile uses Arkadii Quest names for its database, application user,
network, volume, Prometheus job, and dashboard. Take an up-to-date backup and
test a coordinated cutover before changing those values in a live environment.

## Metrics and Dashboards

The CI/CD post-deploy gate confirms all of the following before it marks the
deployment successful:

- `https://arkadii.world/health` returns the game health response;
- `https://arkadii.world/metrics` includes
  `arkadii_quest_server_uptime_seconds`;
- the running server contains the required memory, HTTP request-count, and HTTP
  duration metric families;
- Prometheus reports `up{job="arkadii-quest-server"} == 1`.

Grafana provisions the **Arkadii Quest Overview** dashboard and its Prometheus
datasource automatically from `docker/grafana/provisioning`. Access both
observability services without exposing them publicly:

```bash
ssh -N \
  -L 3001:127.0.0.1:3001 \
  -L 9090:127.0.0.1:9090 \
  arkadii@YOUR_OVH_HOST
```

Then open `http://127.0.0.1:3001` for Grafana or
`http://127.0.0.1:9090/targets` for Prometheus. Sign in to Grafana with
`GRAFANA_ADMIN_USER` and `GRAFANA_ADMIN_PASSWORD` from the production
environment file.

## Operations

| Task | Command |
| --- | --- |
| Start or update public stack | `docker compose --env-file .env.public -f docker-compose.public.yml up -d --build` |
| Stop public stack and keep data | `docker compose --env-file .env.public -f docker-compose.public.yml down` |
| Show Caddy logs | `docker compose --env-file .env.public -f docker-compose.public.yml logs --tail=100 caddy` |
| Show game server logs | `docker compose --env-file .env.public -f docker-compose.public.yml logs --tail=100 server` |
| Check DNS readiness again | `npm run check:public` |
| Validate discovery files | `curl -fsS https://arkadii.world/{robots.txt,sitemap.xml,llms.txt}` |

## Post-Deployment Web Quality

After a public rollout:

1. Open login, character selection, character editor, and the connected game on
   both a desktop and a narrow touch viewport.
2. Complete the entry dialog once in English keyboard/mouse mode and once in
   Russian touch mode; verify translated login/game content in both sessions.
3. Enter the world as a new player, complete the localized onboarding prompt,
   dismiss it, and verify that `F1` reopens the controls table on desktop and
   the guide button reopens it on touch.
4. On desktop, verify WASD movement, stable automatic follow-camera behavior,
   `1`-`9`, panel hotkeys, nearest targeting/interaction, and chat. Confirm that
   wheel and mouse-drag input do not rotate or zoom the gameplay camera.
5. On a phone or tablet, verify joystick movement, automatic camera tracking,
   hotbar, contextual actions, chat, menu panels, portrait layout, and
   short-landscape layout without requiring world-swipe camera control.
6. Confirm keyboard focus remains visible and every touch action has a practical
   target size without HUD/panel overlap.
7. Run Lighthouse against `https://arkadii.world/game/` for Performance,
   Accessibility, Best Practices, and SEO.
8. Confirm the canonical URL and bilingual `VideoGame` JSON-LD in the delivered
   HTML.
9. Submit `https://arkadii.world/sitemap.xml` to the search-engine webmaster
   tools used for the domain.
10. Verify docs navigation opens localization/controls, API/security, and
   game-quality documents.

The branch audit measured 80/100/100/100 for Performance, Accessibility, Best
Practices, and SEO in the local production profile. Public scores can vary with
host, network, and proxy load; semantic/discovery checks should remain stable.

## Security Notes

- Keep `.env.public` out of git.
- Rotate `DATABASE_PASSWORD`, `MYSQL_ROOT_PASSWORD`, and
  `GRAFANA_ADMIN_PASSWORD` before any shared or long-lived deployment.
- Do not publish MySQL, Prometheus, Grafana, or the raw Node.js server port.
- Treat `/metrics` as public unless the Caddy config is changed to restrict it.
- New passwords use salted `scrypt`; valid legacy plaintext rows migrate during
  login. Keep a verified pre-deployment backup and handle dormant accounts with
  a reset policy.
- MySQL startup idempotently enforces a unique, non-null username. Before the
  first rollout over legacy data, inspect `users` for null/empty/overlong names
  and `GROUP BY username HAVING COUNT(*) > 1`; resolve every result manually
  after taking a verified backup. Startup refuses unsafe rows without merging or
  deleting accounts.
- Password fields are removed from authentication payloads, but tokens remain
  bearer credentials and must not enter URLs, logs, or analytics.
- Password login and Quick Play have process-local per-IP fixed-window limits;
  use an infrastructure/shared-store limiter before scaling to multiple Node
  workers or hosts.
- HTTP CORS and browser WebSocket upgrades share an exact-origin allowlist.
  Keep `CORS_ALLOWED_ORIGINS` synchronized with every intentional public
  frontend origin; this browser boundary does not replace authentication.
- New-character/default-loadout creation and complete player snapshot saves are
  atomic MySQL transactions. Keep verified backups despite rollback coverage.
- Gameplay messages have known-type, per-client all/movement/action budgets and
  movement replay/displacement validation. Continue treating combat/economy
  anomaly detection as defense-in-depth work, not a solved anti-cheat problem.
- Add backups before depending on the public MySQL volume for persistent data.
- Resolve the asset provenance gaps recorded in the repository root
  `THIRD_PARTY_ASSETS.md` before a commercial release.

## Troubleshooting

### Caddy Cannot Issue Certificates

Check DNS and firewall first:

```bash
npm run check:public -- --env-file .env.public
docker compose --env-file .env.public -f docker-compose.public.yml logs --tail=100 caddy
```

Let's Encrypt must reach the host on port `80` or `443`.

### Domain Still Opens the Wrong Host

DNS propagation can take time. Compare DNS with the host public IP:

```bash
dig +short arkadii.world A
curl -fsS https://api.ipify.org
```

From Windows, run `Resolve-DnsName arkadii.world` and
`(Invoke-WebRequest https://api.ipify.org).Content` instead.

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
