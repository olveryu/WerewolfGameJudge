# 🚀 部署指南

本文档覆盖从零到生产环境的完整部署流程，包括 Cloudflare Pages 前端部署和 Cloudflare Worker (DO + D1 + R2) API 部署。

---

## 目录

1. [前置要求](#前置要求)
2. [环境变量配置](#环境变量配置)
3. [Web 构建与部署](#web-构建与部署)
4. [缓存策略](#缓存策略)
5. [验证部署](#验证部署)
6. [常见问题](#常见问题)

---

## 前置要求

### 工具安装

```bash
# Node.js (>= 20.20.1)
node --version

# pnpm (workspace monorepo)
pnpm --version

# Wrangler CLI (Cloudflare Workers / Pages)
pnpm add -g wrangler
wrangler --version
```

### 账号准备

- [Cloudflare](https://dash.cloudflare.com) 账号

---

## 环境变量配置

项目遵循 Expo 社区标准的 `.env` 分层约定：

| 文件         | 用途     | Git 状态   |
| ------------ | -------- | ---------- |
| `.env`       | 生产默认 | **已提交** |
| `.env.local` | 本地覆盖 | gitignored |

> Expo 加载优先级：`.env.local` > `.env`（[Expo 官方文档](https://docs.expo.dev/guides/environment-variables/)）。
>
> `EXPO_PUBLIC_*` 不是 secret —— 会 inline 到 JS bundle，客户端可见。
> `EXPO_PUBLIC_SENTRY_DSN`（Sentry 崩溃报告）在 `.env` 中配置（公开值）。

### 零配置开始

clone 后直接运行 —— `.env` 已在 git 中包含生产配置：

```bash
git clone <repo>
pnpm install
pnpm start
```

---

## Web 构建与部署

### 架构总览

| 组件                          | 平台                                       | 部署方式                                                                 |
| ----------------------------- | ------------------------------------------ | ------------------------------------------------------------------------ |
| **前端**（Expo Web 静态资源） | Cloudflare Pages                           | CI `deploy-frontend` job（`scripts/build.sh` + `wrangler pages deploy`） |
| **API**（游戏逻辑 + Auth）    | Cloudflare Worker（`packages/api-worker`） | CI `deploy-api-worker` job                                               |

### CI 自动部署流水线

```
git push main
  → quality (typecheck + lint + test)
  → deploy-api-worker (Cloudflare Worker)
  + deploy-frontend (Cloudflare Pages + CDN cache purge)
  → e2e (Playwright)
```

GitHub CI（`.github/workflows/ci.yml`）在 push 到 `main` 时自动执行：

1. **`quality`** — `pnpm run quality`（typecheck + lint + format + test）
2. **`deploy-api-worker`** — 编译 game-engine → `wrangler deploy`（`packages/api-worker`）
3. **`deploy-frontend`** — `scripts/build.sh` → `wrangler pages deploy dist` → 清除 CDN 缓存（`purge_everything`）
4. **`e2e`** — Playwright 端到端测试（4 shards 并行）

### 职责分离

| 脚本                          | 职责                                               | 命令               |
| ----------------------------- | -------------------------------------------------- | ------------------ |
| `scripts/release.sh`          | 版本号 + CHANGELOG + commit + tag + push           | `pnpm run release` |
| GitHub CI `deploy-frontend`   | 自动构建 + 部署到 Cloudflare Pages + 清除 CDN 缓存 | 自动               |
| GitHub CI `deploy-api-worker` | 自动部署 API Worker                                | 自动               |

### 标准流程（推荐）

```bash
# 1. 发版（bump version → CHANGELOG → commit → tag → push）
pnpm run release              # 默认 patch
pnpm run release -- minor     # 或 minor / major

# 2. 部署自动完成
# git push 自动触发 GitHub CI：
#   - deploy-frontend: build.sh → Cloudflare Pages → 清除 CDN 缓存
#   - deploy-api-worker: packages/api-worker → Cloudflare Worker
# 无需手动操作
```

### `release.sh` 做了什么

1. `pnpm version patch` （或 minor/major）
2. 同步版本号到 `app.json`
3. 检测版本文件之外的改动，交互确认
4. `git commit -m "release: vX.Y.Z"` + `git tag vX.Y.Z`
5. `git push --tags`

---

## 缓存策略

### `web/_headers`（Cloudflare Pages 自定义头）

前端缓存通过 `web/_headers` 文件控制（构建时复制到 `dist/`）：

| 路径                                     | Cache-Control                         | 原因                                                                  |
| ---------------------------------------- | ------------------------------------- | --------------------------------------------------------------------- |
| `/assets/fonts/*`                        | `immutable, max-age=31536000`         | 内容哈希文件名，永不变更                                              |
| `/assets/audio/*`、`/assets/audio_end/*` | `immutable, max-age=31536000`         | 同上                                                                  |
| `/assets/js/*`                           | `no-cache`                            | Metro 使用 source-hash（非 content-hash），同名文件跨构建内容可能不同 |
| `/`、`/index.html`                       | `no-cache`                            | HTML 必须每次验证，否则引用已删除 JS → 白屏                           |
| `/sw.js`                                 | `no-cache, no-store, must-revalidate` | Service Worker 必须始终最新                                           |

### CDN 缓存清除

CI `deploy-frontend` job 在部署后自动调用 Cloudflare API `purge_everything`，确保 Zone CDN 缓存立即更新。

> ⚠️ Cloudflare Dashboard → Zone → Caching → Browser Cache TTL 必须设为 **Respect Existing Headers**，否则 Zone CDN 会覆盖 `_headers` 中定义的策略。

---

## 验证部署

### 1. 检查前端

访问 https://werewolfjudge.eu.org（或 https://werewolfgamejudge.pages.dev）：

- 页面正常加载，无白屏
- 检查 JS 请求的 `Cache-Control` header 是否为 `no-cache`

### 2. 检查 API 连接

- 点击「创建房间」
- 如果成功创建房间，说明 API 连接正常

### 3. 测试多设备同步

1. 在设备 A 创建房间，记录房间号
2. 在设备 B 输入房间号加入
3. 如果设备 B 能看到房间状态，说明 WebSocket 正常

### 4. 检查匿名登录

- 无需注册即可创建/加入房间 ✓

---

## 常见问题

### Q1: 部署后页面白屏

**可能原因**:

1. **CDN 缓存未清除** — CI 正常部署时会自动清除。手动部署后需手动清除：

   ```bash
   curl -sf -X POST \
     "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/purge_cache" \
     -H "Authorization: Bearer <API_TOKEN>" \
     -H "Content-Type: application/json" \
     --data '{"purge_everything":true}'
   ```

2. **Browser Cache TTL 设置错误** — 确认 Cloudflare Dashboard → Caching → Browser Cache TTL 为 **Respect Existing Headers**。

### Q2: Realtime 不工作（加入房间后看不到更新）

**原因**: WebSocket 连接失败

**解决**: 检查 Cloudflare Worker Durable Objects 部署状态，确认 `deploy-api-worker` CI job 成功。

### Q3: 如何更新部署？

```bash
pnpm run release    # 版本号 + CHANGELOG + commit + tag + push
# git push 自动触发 CI：deploy-frontend + deploy-api-worker
```

### Q4: 如何回滚？

```bash
# Cloudflare Pages 支持按 deployment 回滚：
# Dashboard → Pages → werewolfgamejudge → Deployments → 选择旧部署 → Rollback

# 或通过 wrangler CLI：
wrangler pages deployments list --project-name=werewolfgamejudge
wrangler pages deployments rollback --project-name=werewolfgamejudge <deployment-id>
```

---

## 快速参考

| 操作            | 命令                                                     |
| --------------- | -------------------------------------------------------- |
| **本地开发**    |                                                          |
| 启动开发服务器  | `pnpm start`                                             |
| **生产部署**    |                                                          |
| 发版            | `pnpm run release` (patch) / `pnpm run release -- minor` |
| 前端 + API 部署 | `git push` 自动触发 GitHub CI                            |
| 全量质量检查    | `pnpm run quality`                                       |
| 清除 CDN 缓存   | CI 自动执行；手动见 Q1                                   |
| 回滚前端        | Cloudflare Pages Dashboard → Rollback                    |

---

## 当前生产环境

| 服务                   | URL                                                   |
| ---------------------- | ----------------------------------------------------- |
| **前端**（自定义域名） | https://werewolfjudge.eu.org                          |
| **前端**（Pages 默认） | https://werewolfgamejudge.pages.dev                   |
| **API**                | https://api.werewolfjudge.eu.org（Cloudflare Worker） |
| **崩溃监控**           | Sentry                                                |
