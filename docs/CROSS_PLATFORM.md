# Cross-Platform Operations

Arkadii Quest supports development and operational checks from Windows and
Linux/macOS. The game containers themselves run Linux images, so Docker Desktop
must use Linux containers on Windows. The OVH production host and the GitHub
deployment runner remain Linux by design; Windows can prepare and administer
them over SSH without WSL.

## Support Matrix

| Task | Windows | Linux/macOS |
| --- | --- | --- |
| Install dependencies, test, build, E2E, audit | PowerShell 7 with Node.js 22 | Bash with Node.js 22 |
| Local Docker stack | Docker Desktop, Linux container mode | Docker Engine with Compose plugin |
| Local HTTPS domains and trusted certificate | `scripts/setup-local-domain.ps1` in elevated PowerShell | `scripts/setup-local-domain.sh` with `sudo` and OpenSSL |
| Public readiness check | `npm run check:public` or `scripts/check-public-readiness.ps1` | `npm run check:public` or `scripts/check-public-readiness.sh` |
| OVH bootstrap | `scripts/deploy/bootstrap-ovh.ps1` over SSH | `sudo bash scripts/deploy/bootstrap-ovh.sh` on the server |
| Production deployment | GitHub Actions after a push to `main` | GitHub Actions after a push to `main` |

## Local Docker Stack

Install Node.js 22, Docker Compose, and project dependencies on either system:

```bash
npm ci
```

Prepare the local environment and certificate.

Windows PowerShell 7, launched once as Administrator:

```powershell
Copy-Item .env.example .env
pwsh -ExecutionPolicy Bypass -File .\scripts\setup-local-domain.ps1
docker compose up -d --build
```

Linux/macOS:

```bash
cp .env.example .env
scripts/setup-local-domain.sh
docker compose up -d --build
```

The common application commands are identical:

```text
npm test
npm run check:localization
npm run check:web-quality
npx tsc --noEmit
npm run client-build
npm run server-build
npm run test:e2e
docker compose config
```

For host-only SQLite development, set the database variable in the native shell:

```powershell
$env:APP_DATABASE = "sqllite"
npm run server-dev
```

```bash
APP_DATABASE=sqllite npm run server-dev
```

Run `npm run client-dev` in another terminal. The spelling `sqllite` is the
existing configuration key.

## Smoke Tests and Load Tests

Use CLI parameters rather than shell-specific environment-variable syntax. These
commands work unchanged in PowerShell, cmd.exe, Bash, and CI:

```text
npm run smoke:ws -- --token <account-token> --character-id <owned-character-id>
npm run loadtest -- --token <account-token> --character-id <owned-character-id>
```

Optional smoke-test parameters are `--endpoint`, `--room`,
`--location`, and `--timeout-ms`. Environment variables remain
supported for automation, but are no longer required for interactive use.

## Public Readiness and Local Validation

The readiness checker is implemented in Node.js and works on both systems:

```text
npm run check:public -- --env-file .env.public
```

The platform-specific wrappers are equivalent:

```powershell
.\scripts\check-public-readiness.ps1 -EnvFile .env.public
```

```bash
scripts/check-public-readiness.sh .env.public
```

Validate the public Compose profile on both platforms:

```text
docker compose --env-file .env.public -f docker-compose.public.yml config -q
```

Caddy validation needs native path syntax:

```powershell
docker run --rm -v "${PWD}/docker/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile
```

```bash
docker run --rm -v "$PWD/docker/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile
```

Use `Invoke-WebRequest` in PowerShell or `curl` in Bash for HTTP checks:

```powershell
(Invoke-WebRequest https://arkadii.game.local/health).Content
```

```bash
curl -fsS https://arkadii.game.local/health
```

## OVH from Windows or Linux

The server bootstrap intentionally installs Linux packages and firewall rules on
the Ubuntu OVH host. Run it directly on that host from Linux:

```bash
sudo bash scripts/deploy/bootstrap-ovh.sh
```

Or launch the same remote script from Windows after verifying the server host
key and installing the Windows OpenSSH Client:

```powershell
.\scripts\deploy\bootstrap-ovh.ps1 -Host YOUR_OVH_HOST -IdentityFile "$HOME\.ssh\arkadii-quest-admin" -KnownHostsFile "$HOME\.ssh\known_hosts"
```

The PowerShell wrapper uses strict host-key checking and does not accept a new
or changed server fingerprint automatically. It sends the versioned Linux
bootstrap script to the server through SSH; no WSL installation is needed.

After bootstrap, configure GitHub Environment secrets as described in
[Public Deployment](./PUBLIC_DEPLOYMENT.md#github-production-environment).
GitHub Actions always builds and deploys from Linux, while the verification job
also runs on Windows to prevent Windows-only regressions.
