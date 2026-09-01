# Deployment Guide

This guide documents the official production path for the Cloudflare Worker API, Cloudflare Pages frontend, versioned npmmirror assets, WeChat Mini Program, and Playwright report site.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Configuration and Secrets](#configuration-and-secrets)
3. [CI Deployment Pipeline](#ci-deployment-pipeline)
4. [Frontend CDN and Caching](#frontend-cdn-and-caching)
5. [Release Process](#release-process)
6. [Local Verification](#local-verification)
7. [Production Verification](#production-verification)
8. [Rollback](#rollback)
9. [Troubleshooting](#troubleshooting)

## Prerequisites

### Toolchain

- Node.js `22.22.1` from `.nvmrc`; `package.json` accepts Node.js `>=22.13.0`.
- pnpm `10.32.1` through the `packageManager` field.
- Wrangler is a workspace dependency. Do not install a separate global copy.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm exec wrangler --version
```

### Service Setup

The official deployment requires:

- A Cloudflare account with the D1 database, R2 bucket, Durable Object namespaces, Analytics Engine datasets, Worker custom domain, and Pages project named in the Wrangler configuration.
- A GitHub repository with Actions enabled and the deployment secrets listed below.
- The npm package `werewolf-judge-cdn` configured with a GitHub Actions trusted publisher for this repository and workflow `ci.yml`.
- GitHub Pages configured to deploy from GitHub Actions for the merged Playwright report.
- A WeChat Mini Program whose AppID and upload key match the workflow configuration.

Forks and self-hosted deployments must replace the official account IDs, database IDs, bucket and project names, custom domains, npm package name, Sentry project, GitHub feedback repository, and WeChat AppID. Do not point a fork at the official production resources.

## Configuration and Secrets

### Client Build Environment

The committed `.env` contains public Expo build defaults. Any `EXPO_PUBLIC_*` value is embedded in the client bundle and must never contain a secret. Use gitignored `.env.local` for local overrides; Expo gives `.env.local` precedence over `.env`.

The frontend CI build provides these values directly:

| Variable                 | Purpose                                                               |
| ------------------------ | --------------------------------------------------------------------- |
| `CF_PAGES_BRANCH`        | Selects `EXPO_PUBLIC_DEPLOY_ENV`; `main` maps to `production`         |
| `EXPO_PUBLIC_SENTRY_DSN` | Public client DSN embedded in the web bundle                          |
| `SENTRY_AUTH_TOKEN`      | Build-only source-map upload credential; never embedded in the bundle |

### Worker Runtime Secrets

`packages/api-worker/wrangler.toml` declares the required Worker secrets:

| Secret                  | Purpose                                                |
| ----------------------- | ------------------------------------------------------ |
| `ADMIN_PASSWORD`        | Admin API authentication                               |
| `CF_API_TOKEN`          | Cloudflare Analytics API queries from the admin API    |
| `GEMINI_API_KEY`        | Gemini AI requests                                     |
| `GITHUB_REPO_OWNER`     | GitHub feedback integration configuration              |
| `GITHUB_TOKEN`          | Create and update feedback issues and comments         |
| `GITHUB_WEBHOOK_SECRET` | Verify feedback webhook signatures                     |
| `JWT_SECRET`            | Sign access tokens and derive refresh-token successors |
| `RESEND_API_KEY`        | Send password-reset email through Resend               |
| `WECHAT_APP_ID`         | WeChat `code2Session` client identifier                |
| `WECHAT_APP_SECRET`     | WeChat `code2Session` credential                       |

Set each value through Wrangler's interactive prompt. Never put secret values in a command, shell history, committed file, or documentation.

```bash
cd packages/api-worker
pnpm exec wrangler secret put JWT_SECRET --config wrangler.toml
pnpm exec wrangler secret list --config wrangler.toml
```

### GitHub Actions Secrets

| Secret                  | Job                         |
| ----------------------- | --------------------------- |
| `CLOUDFLARE_API_TOKEN`  | Worker and Pages deployment |
| `CLOUDFLARE_ACCOUNT_ID` | Worker and Pages deployment |
| `SENTRY_DSN`            | Frontend production build   |
| `SENTRY_AUTH_TOKEN`     | Frontend source-map upload  |
| `MINIAPP_UPLOAD_KEY`    | WeChat Mini Program upload  |

`GITHUB_TOKEN` is supplied by GitHub Actions. Frontend asset publication uses npm trusted publishing with OIDC and `id-token: write`; there is no `NPM_TOKEN`. The workflow upgrades to npm 11 because trusted publishing requires npm `>=11.5.1`.

## CI Deployment Pipeline

`.github/workflows/ci.yml` runs on pushes to `main`, pull requests targeting `main`, and manual dispatches.

```text
quality
├── e2e (five balanced groups) → merge-reports
│                              └── deploy-e2e-report (main only)
├── deploy-api-worker (main only)
│   └── deploy-frontend (main only; waits for API deployment)
└── deploy-miniapp (main push only; conditional upload)
```

E2E uses local Wrangler/D1 and a local web build. It validates the commit independently of the production deployment and does not wait for the deploy jobs.

### Quality

`pnpm run quality` is the single local quality entry point. CI executes the same stages in this order:

1. Type generation and TypeScript checks.
2. `game-engine` build.
3. Knip unused-code and dependency check.
4. Agent adapter drift check.
5. ESLint.
6. Prettier check.
7. All workspace unit and integration tests.

### API Worker

After `quality` succeeds on `main`, `deploy-api-worker`:

1. Builds `@game-judge/game-engine`.
2. Applies remote D1 migrations with the API package's `db:migrate:remote` script.
3. Deploys `werewolf-api` with the API package's `deploy` script.

Migrations run before Worker deployment. A migration failure stops the job and leaves the previous Worker deployed.

### Frontend

`deploy-frontend` waits for both `quality` and `deploy-api-worker`, then:

1. Runs `scripts/build.sh` to build `game-engine`, export Expo Web, add PWA files, fix font and bundle paths, inject the custom HTML shell, and upload Sentry source maps.
2. Rewrites HTML and JavaScript asset references to a versioned npmmirror URL.
3. Packages assets and compressed CanvasKit WASM as `werewolf-judge-cdn@0.0.0-g<sha8>`.
4. Publishes that package to npm with OIDC trusted publishing.
5. Waits for npm registry visibility.
6. Triggers npmmirror synchronization and polls both npmmirror registry metadata and the CDN `index.js` artifact for up to 15 minutes.
7. Deploys `dist/` to the `werewolfgamejudge` Cloudflare Pages project only after both CDN checks pass.

This order prevents production HTML from referencing an asset package that the CDN cannot yet serve.

### WeChat Mini Program

`deploy-miniapp` runs only on a push to `main`. It uploads when either condition is true:

- The commit subject starts with `release:`.
- Files under `miniapp/` changed in the commit.

The workflow reads the version from `package.json` and removes the temporary upload-key file after `miniprogram-ci` finishes.

### Playwright E2E

CI divides the E2E suite into five measured groups. Each group uses the local Cloudflare Worker and D1 database created by `scripts/setup-e2e-api.mjs`; it does not connect to production data. Blob reports are retained for one day, merged into an HTML report retained for 30 days, and published to GitHub Pages for successful `main` runs.

## Frontend CDN and Caching

Production HTML points to assets under a commit-specific URL:

```text
https://cdn.npmmirror.com/packages/werewolf-judge-cdn/0.0.0-g<sha8>/files/
```

Each deployment therefore references an immutable package version. The pipeline does not perform a blanket Cloudflare cache purge and does not require a long-lived npm token.

`web/_headers` controls files served by Cloudflare Pages:

| Path                                                      | Cache-Control                         | Reason                                                 |
| --------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------ |
| `/assets/fonts/*`                                         | `public, max-age=31536000, immutable` | Content-hashed fonts                                   |
| `/assets/audio/*`, `/assets/audio_end/*`, `/assets/pwa/*` | `public, max-age=31536000, immutable` | Versioned static assets                                |
| `/assets/js/*`                                            | `no-cache`                            | Safe fallback when a bundle is served from Pages       |
| `/`, `/index.html`                                        | `no-cache`                            | HTML must revalidate before selecting an asset package |
| `/HVChYlYloJ.txt`                                         | `no-cache, no-store, must-revalidate` | WeChat domain verification                             |

The same file sets `X-Content-Type-Options`, `X-Frame-Options`, and `Referrer-Policy` response headers.

## Release Process

`package.json` and `pnpm-lock.yaml` are the authoritative version sources. Run the release script only from a clean, reviewed worktree:

```bash
pnpm run quality
pnpm run release            # patch
pnpm run release -- minor   # minor
pnpm run release -- major   # major
```

`scripts/release.sh`:

1. Refuses unsupported bump types and asks before including unrelated changes.
2. Bumps `package.json` and `pnpm-lock.yaml`.
3. Synchronizes `app.json`.
4. Requires a matching entry in `src/config/announcements.ts`.
5. Updates `CHANGELOG.md` from commits since the previous tag.
6. Creates commit `release: v<version>` and tag `v<version>`.
7. Pushes the commit and tags, which triggers CI and the GitHub Release workflow.

Do not bypass Git hooks with `--no-verify`.

## Local Verification

```bash
pnpm install
pnpm run dev       # Worker on :8787 and Expo Web on :8081
pnpm run quality   # Complete non-E2E quality gate
pnpm run e2e       # Playwright starts isolated local API and web servers
```

For a new local D1 state or after adding a migration:

```bash
pnpm --filter @game-judge/api-worker run db:migrate:local
pnpm --filter @game-judge/api-worker run db:seed:local
```

Production frontend deployment must use CI because URL rewriting, npm publication, npmmirror propagation checks, and Pages deployment form one ordered operation. A direct local Pages upload skips those gates.

## Production Verification

1. Confirm `quality`, `deploy-api-worker`, and `deploy-frontend` succeeded in GitHub Actions.
2. Confirm the frontend job recorded the expected npm package version and both npmmirror checks passed.
3. Visit [werewolfgamer.com](https://werewolfgamer.com) and confirm the document and versioned CDN assets load without errors.
4. Request [api.werewolfjudge.eu.org/health](https://api.werewolfjudge.eu.org/health) and confirm the Worker is healthy.
5. Create a room, join it from a second browser or device, and confirm WebSocket state synchronization.
6. Open the merged Playwright report artifact or the GitHub Pages report for the run.

## Rollback

### Frontend

In Cloudflare Dashboard, open **Workers & Pages -> werewolfgamejudge -> Deployments**, select the menu for a previous successful production deployment, and choose **Rollback to this deployment**. Preview deployments cannot be rollback targets.

An older HTML deployment continues to reference its immutable npm/npmmirror asset version. Do not unpublish historical `werewolf-judge-cdn` versions that may still be rollback targets.

### API Worker

Use Cloudflare's Worker version rollback from the dashboard or Wrangler:

```bash
cd packages/api-worker
pnpm exec wrangler versions list --config wrangler.toml
pnpm exec wrangler rollback <VERSION_ID> --config wrangler.toml
```

D1 migrations are not reverted by a Worker rollback. Database rollback requires a separately reviewed forward migration that preserves compatibility with the selected Worker version.

## Troubleshooting

### npm publish reports `ENEEDAUTH`

Verify the npm trusted publisher uses the exact GitHub owner, repository, and workflow filename `ci.yml`; confirm the job runs on a GitHub-hosted runner with `id-token: write`. Do not add `NPM_TOKEN` as a workaround.

### npmmirror propagation times out

The workflow retriggers synchronization and polls for up to 15 minutes. If either registry metadata or the CDN artifact is still missing, Pages deployment correctly stops. Inspect the reported sync task and artifact URLs, then rerun the failed job after npmmirror recovers.

### Frontend loads a white screen

Inspect `index.html` to identify its `0.0.0-g<sha8>` asset version, then verify that version's JavaScript and CanvasKit artifacts on npmmirror. Also confirm HTML responses use `no-cache`. A blanket Cloudflare cache purge is not part of this architecture.

### API deployment fails after a migration

Inspect the `Apply D1 migrations` step first. Do not deploy the new Worker manually around a failed migration. Correct the migration or compatibility issue, verify it locally, and rerun the CI job.

### Realtime updates fail

Confirm the Worker deployment is healthy, the `GAME_ROOM` Durable Object binding exists, and the browser can establish a WebSocket to the API custom domain.

## Current Production Endpoints

| Service                  | URL                                   |
| ------------------------ | ------------------------------------- |
| Frontend                 | <https://werewolfgamer.com>           |
| Cloudflare Pages default | <https://werewolfgamejudge.pages.dev> |
| API Worker               | <https://api.werewolfjudge.eu.org>    |
