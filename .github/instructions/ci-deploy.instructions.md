---
name: 'CI & Deploy'
description: 'CI/CD 流水线、build.sh、CDN 发布、D1 迁移、release 流程'
applyTo: '.github/workflows/**,scripts/build.sh,scripts/release.sh'
---

# CI/CD & 部署规范

## CI 流水线（`.github/workflows/ci.yml`）

质量门禁 → 条件部署。仅 main 分支触发部署。

```
quality → deploy-api-worker (main only)
        → deploy-frontend  (main only)
```

**quality job 顺序**：typecheck → lint → format → test:all

### deploy-api-worker

1. `pnpm --filter @werewolf/game-engine run build`（Worker 依赖 game-engine dist/）
2. `wrangler d1 migrations apply werewolf-db --remote`（**迁移先于部署**）
3. `wrangler deploy`

### deploy-frontend

1. `bash scripts/build.sh`（Expo export → PWA post-processing）
2. Rewrite asset URLs → CDN absolute paths（`cdn.npmmirror.com`）
3. `npm publish werewolf-judge-cdn@0.0.0-<sha8>`（JS bundles + WASM）
4. Cloudflare Pages publish（HTML 引用 CDN URL）

## scripts/build.sh

Cloudflare Pages 构建入口。流程：

1. Build game-engine（`pnpm --filter @werewolf/game-engine run build`）
2. `npx expo export --platform web`
3. PWA manifest + service worker 注入
4. Font 文件 post-processing
5. Custom `index.html` 模板替换

**环境变量**：`CF_PAGES_BRANCH` → `EXPO_PUBLIC_DEPLOY_ENV`（production | preview）。
`EXPO_PUBLIC_*` 变量由 Metro 在 bundle 阶段内联，非运行时读取。

## CDN 发布流程

- JS chunks + CanvasKit WASM 发布为 npm 包 → npmmirror 自动同步
- npm token（GitHub secret `NPM_TOKEN`）90 天有效，过期后 deploy-frontend 失败
- 手动触发同步：`curl -sX PUT "https://registry-direct.npmmirror.com/-/package/werewolf-judge-cdn/syncs"`

## Release 流程

`scripts/release.sh`（或 `pnpm run release`）：

1. Bump version（package.json → app.json → `src/config/version.ts`，三文件同步）
2. 更新 CHANGELOG.md
3. Git commit + tag `v<version>` + push

GitHub Actions `release.yml` 在 `v*` tag 上创建 GitHub Release。

## D1 迁移

- 本地：`pnpm -F @werewolf/api-worker db:migrate:local`
- 远程（CI）：`wrangler d1 migrations apply werewolf-db --remote`
- 新 migration 后本地需重新 migrate，否则 Worker 启动报 schema 错误

## Secrets 清单

| Secret                  | 用途               | 续签周期 |
| ----------------------- | ------------------ | -------- |
| `CLOUDFLARE_API_TOKEN`  | Wrangler 部署      | —        |
| `CLOUDFLARE_ACCOUNT_ID` | Wrangler 账户标识  | —        |
| `NPM_TOKEN`             | npm publish CDN 包 | 90 天    |
| `SENTRY_DSN`            | 前端 Sentry 上报   | —        |
| `SENTRY_AUTH_TOKEN`     | Source map 上传    | —        |
