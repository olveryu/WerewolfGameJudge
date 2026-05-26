# 🚀 Deployment Guide

This document covers the complete deployment process from zero to production, including Cloudflare Pages frontend deployment and Cloudflare Worker (DO + D1 + R2) API deployment.

---

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Environment Variables](#environment-variables)
3. [Web Build & Deploy](#web-build--deploy)
4. [Caching Strategy](#caching-strategy)
5. [Verify Deployment](#verify-deployment)
6. [FAQ](#faq)

---

## Prerequisites

### Tool Installation

```bash
# Node.js (>= 20.20.1)
node --version

# pnpm (workspace monorepo)
pnpm --version

# Wrangler CLI (Cloudflare Workers / Pages)
pnpm add -g wrangler
wrangler --version
```

### Account Setup

- [Cloudflare](https://dash.cloudflare.com) account

---

## Environment Variables

The project follows Expo community standard `.env` layering conventions:

| File         | Purpose            | Git Status    |
| ------------ | ------------------ | ------------- |
| `.env`       | Production default | **Committed** |
| `.env.local` | Local override     | gitignored    |

> Expo load priority: `.env.local` > `.env` ([Expo official docs](https://docs.expo.dev/guides/environment-variables/)).
>
> `EXPO_PUBLIC_*` are not secrets — they get inlined into the JS bundle and are visible to clients.
> `EXPO_PUBLIC_SENTRY_DSN` (Sentry crash reporting) is configured in `.env` (public value).

### Zero-Config Start

Run directly after clone — `.env` already contains production config in git:

```bash
git clone <repo>
pnpm install
pnpm start
```

---

## Web Build & Deploy

### Architecture Overview

| Component                             | Platform                                  | Deployment Method                                                       |
| ------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------- |
| **Frontend** (Expo Web static assets) | Cloudflare Pages                          | CI `deploy-frontend` job (`scripts/build.sh` + `wrangler pages deploy`) |
| **API** (Game logic + Auth)           | Cloudflare Worker (`packages/api-worker`) | CI `deploy-api-worker` job                                              |

### CI Auto-Deploy Pipeline

```
git push main
  → quality (typecheck + lint + test)
  → deploy-api-worker (Cloudflare Worker)
  + deploy-frontend (Cloudflare Pages + CDN cache purge)
  → e2e (Playwright)
```

GitHub CI (`.github/workflows/ci.yml`) auto-executes on push to `main`:

1. **`quality`** — `pnpm run quality` (typecheck + lint + format + test)
2. **`deploy-api-worker`** — Build game-engine → `wrangler deploy` (`packages/api-worker`)
3. **`deploy-frontend`** — `scripts/build.sh` → `wrangler pages deploy dist` → Purge CDN cache (`purge_everything`)
4. **`e2e`** — Playwright end-to-end tests (4 shards in parallel)

### Separation of Concerns

| Script                        | Responsibility                                            | Command            |
| ----------------------------- | --------------------------------------------------------- | ------------------ |
| `scripts/release.sh`          | Version bump + CHANGELOG + commit + tag + push            | `pnpm run release` |
| GitHub CI `deploy-frontend`   | Auto build + deploy to Cloudflare Pages + purge CDN cache | Automatic          |
| GitHub CI `deploy-api-worker` | Auto deploy API Worker                                    | Automatic          |

### Standard Process (Recommended)

```bash
# 1. Release (bump version → CHANGELOG → commit → tag → push)
pnpm run release              # default: patch
pnpm run release -- minor     # or minor / major

# 2. Deployment happens automatically
# git push auto-triggers GitHub CI:
#   - deploy-frontend: build.sh → Cloudflare Pages → purge CDN cache
#   - deploy-api-worker: packages/api-worker → Cloudflare Worker
# No manual action needed
```

### What `release.sh` Does

1. `pnpm version patch` (or minor/major)
2. Syncs version number to `app.json`
3. Detects changes beyond version files, prompts for interactive confirmation
4. `git commit -m "release: vX.Y.Z"` + `git tag vX.Y.Z`
5. `git push --tags`

---

## Caching Strategy

### `web/_headers` (Cloudflare Pages Custom Headers)

Frontend caching is controlled via the `web/_headers` file (copied to `dist/` at build time):

| Path                                     | Cache-Control                         | Reason                                                                            |
| ---------------------------------------- | ------------------------------------- | --------------------------------------------------------------------------------- |
| `/assets/fonts/*`                        | `immutable, max-age=31536000`         | Content-hashed filenames, never change                                            |
| `/assets/audio/*`, `/assets/audio_end/*` | `immutable, max-age=31536000`         | Same as above                                                                     |
| `/assets/js/*`                           | `no-cache`                            | Metro uses source-hash (not content-hash); same filename may differ across builds |
| `/`, `/index.html`                       | `no-cache`                            | HTML must revalidate every time, otherwise references deleted JS → white screen   |
| `/sw.js`                                 | `no-cache, no-store, must-revalidate` | Service Worker must always be fresh                                               |

### CDN Cache Purge

The CI `deploy-frontend` job automatically calls Cloudflare API `purge_everything` after deployment, ensuring Zone CDN cache updates immediately.

> ⚠️ Cloudflare Dashboard → Zone → Caching → Browser Cache TTL must be set to **Respect Existing Headers**, otherwise Zone CDN will override the policies defined in `_headers`.

---

## Verify Deployment

### 1. Check Frontend

Visit https://werewolfjudge.eu.org (or https://werewolfgamejudge.pages.dev):

- Page loads normally, no white screen
- Check that JS requests' `Cache-Control` header is `no-cache`

### 2. Check API Connection

- Tap "创建房间"
- If a room is created successfully, the API connection is working

### 3. Test Multi-Device Sync

1. Create a room on Device A, note the room code
2. Enter the room code on Device B to join
3. If Device B can see the room state, WebSocket is working

### 4. Check Anonymous Login

- Can create/join rooms without registration ✓

---

## FAQ

### Q1: White Screen After Deployment

**Possible causes**:

1. **CDN cache not purged** — CI auto-purges on normal deployment. After manual deployment, purge manually:

   ```bash
   curl -sf -X POST \
     "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/purge_cache" \
     -H "Authorization: Bearer <API_TOKEN>" \
     -H "Content-Type: application/json" \
     --data '{"purge_everything":true}'
   ```

2. **Browser Cache TTL misconfigured** — Confirm Cloudflare Dashboard → Caching → Browser Cache TTL is **Respect Existing Headers**.

### Q2: Realtime Not Working (No Updates After Joining Room)

**Cause**: WebSocket connection failure

**Solution**: Check Cloudflare Worker Durable Objects deployment status, confirm `deploy-api-worker` CI job succeeded.

### Q3: How to Update Deployment?

```bash
pnpm run release    # version bump + CHANGELOG + commit + tag + push
# git push auto-triggers CI: deploy-frontend + deploy-api-worker
```

### Q4: How to Rollback?

```bash
# Cloudflare Pages supports per-deployment rollback:
# Dashboard → Pages → werewolfgamejudge → Deployments → Select old deployment → Rollback

# Or via wrangler CLI:
wrangler pages deployments list --project-name=werewolfgamejudge
wrangler pages deployments rollback --project-name=werewolfgamejudge <deployment-id>
```

---

## Quick Reference

| Action                | Command                                                  |
| --------------------- | -------------------------------------------------------- |
| **Local Dev**         |                                                          |
| Start dev server      | `pnpm start`                                             |
| **Production**        |                                                          |
| Release               | `pnpm run release` (patch) / `pnpm run release -- minor` |
| Frontend + API deploy | `git push` auto-triggers GitHub CI                       |
| Full quality check    | `pnpm run quality`                                       |
| Purge CDN cache       | CI auto-executes; manual see Q1                          |
| Rollback frontend     | Cloudflare Pages Dashboard → Rollback                    |

---

## Current Production Environment

| Service                      | URL                                                  |
| ---------------------------- | ---------------------------------------------------- |
| **Frontend** (custom domain) | https://werewolfjudge.eu.org                         |
| **Frontend** (Pages default) | https://werewolfgamejudge.pages.dev                  |
| **API**                      | https://api.werewolfjudge.eu.org (Cloudflare Worker) |
| **Crash Monitoring**         | Sentry                                               |
