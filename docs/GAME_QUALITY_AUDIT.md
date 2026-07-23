# Game Quality Audit

Audit date: 2026-07-23
Branch: `improvements/game-experience-a11y-seo`

## Outcome

The pass covered the production login flow, character selection and editor,
in-game HUD, asset loading, server API behavior, discoverability, keyboard
focus, reduced-motion behavior, and failure handling. Visual checks used a real
WebGL Chromium session at `1440x900` and `412x915`.

This report describes branch behavior. Root discovery files and updated public
headers become externally visible only after this branch is deployed through
the public Caddy profile.

| Metric | Baseline | After |
| --- | ---: | ---: |
| Lighthouse Performance | 67 | 80 |
| Lighthouse Accessibility | 73 | 100 |
| Lighthouse Best Practices | 96 | 100 |
| Lighthouse SEO | 90 | 100 |
| First Contentful Paint | 1.8 s | 0.8 s |
| Largest Contentful Paint | 15.9 s | 5.2 s |
| Total Blocking Time | 310 ms | 90 ms |
| Cumulative Layout Shift | 0 | 0 |
| Initial game resources | 101 | 88-89 |
| Real WebGL loading time | about 8.7 s | about 3.4 s |

The production JavaScript entrypoint remains about 2.7 MiB. Initial game transfer is
still about 17.8 MiB because the world, VAT data, models, audio, and textures are
loaded up front. Runtime aliasing now prevents duplicate requests for identical
race and VAT source files, but deeper route-based asset streaming is still a
separate performance project.

## Changes Verified

- Rebuilt the login experience with native HTML form controls, visible focus,
  browser validation, live status, touch-sized actions, and responsive layout.
- Added a progress loader and an actionable WebGL/startup failure screen instead
  of leaving the player on an indefinite loading marker.
- Reworked mobile HUD geometry so the player bar, menu, chat, hotbar, and panels
  no longer obscure each other. Inventory and menu flyouts now start closed on
  compact screens.
- Reworked character selection and character creation for desktop and mobile.
  Labels, lists, the 3D model, name field, and actions remain visible at 412x915.
- Reduced compact-render cost and disabled mobile shadows while preserving the
  desktop scene.
- Deduplicated asset requests and fixed the shadow-caster filter.
- Moved credentials and tokens from URL query strings to JSON request bodies.
- Added `scrypt` password hashing, automatic upgrade of legacy plaintext rows
  after a valid login, generic wrong-password responses, and password removal
  from all authentication payloads.
- Added compression, cache headers, bounded JSON parsing, safer help-page path
  handling, predictable API errors, and removed the Express disclosure header.
- Added canonical metadata, Open Graph and Twitter data, VideoGame JSON-LD,
  `manifest.webmanifest`, `robots.txt`, `sitemap.xml`, and `llms.txt`.
- Added root discovery routes to the public Caddy profile.
- Updated repository and served documentation with architecture, API/security,
  QA, local operations, and public rollout guidance.

## Visual And Functional Matrix

| Surface | Desktop | Mobile | Result |
| --- | --- | --- | --- |
| Loading and login | 1440x900 | 412x915 | Pass |
| Character selection | 1440x900 | 412x915 | Pass |
| Character editor | 1440x900 | 412x915 | Pass |
| Connected game HUD | 1440x900 | 412x915 | Pass |
| No-WebGL fallback | 1280x720 headless | N/A | Pass |

The connected end-to-end run completed login, character selection, Colyseus
room join, world load, and HUD render without console errors, page errors, or
failed requests.

## Asset Review

- The login and loader reuse the existing 1280x720 game background and logo,
  avoiding an unrelated stock visual.
- Large dormant candidates include `textures/sprites/slash_01.jpg` (1.27 MiB),
  `textures/sprites/explosion_01.webp` (644 KiB), and old `male_*` race/VAT
  files. They were not removed because existing production characters or future
  content may still reference those race keys.
- Only `construction/Models/Characters/goblin/license.txt` and
  `construction/Fonts/info.txt` were found as explicit provenance records.
  A complete source, author, license, and modification ledger is required before
  a commercial release.

## Accessibility Notes

The HTML shell now has language, main and heading landmarks, skip navigation,
descriptions, live regions, keyboard focus indicators, form labels, and reduced
motion support. Lighthouse reports 100 for the audited entry screen.

Babylon GUI and 3D gameplay remain primarily visual and pointer driven. Full
screen-reader parity for inventory, combat, and character management requires a
native DOM command layer or equivalent accessible controls and is not claimed by
this audit.

## Dependency Review

Upgrading `sqlite3` to 6.x and `copy-webpack-plugin` to 14.x removed all high and
critical audit findings. The complete tree now reports 2 low and 12 moderate
findings; the production tree reports 2 low and 10 moderate findings. Remaining
production advisories are in the Colyseus 0.15 authentication/core chain and
require a tested 0.17 protocol migration rather than a forced lockfile rewrite.
Endpoint-level hardening boundaries are tracked in
[API and Security](./API_AND_SECURITY.md).

## Reproduce

```bash
npm run check:web-quality
npx tsc --noEmit
npm run client-build
npm run server-build
docker compose --env-file .env.public.example -f docker-compose.public.yml config --quiet
docker run --rm -v "$PWD/docker/caddy/Caddyfile:/etc/caddy/Caddyfile:ro" caddy:2-alpine caddy validate --config /etc/caddy/Caddyfile
npm audit --omit=dev
```

Lighthouse was run against the production server at `http://127.0.0.1:3000/`.
Scores can vary slightly with CPU load, but semantic and discoverability audits
should remain at 100.
