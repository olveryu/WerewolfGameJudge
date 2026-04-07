# 🚀 部署指南

本文档覆盖从零到生产环境的完整部署流程，包括 Supabase 配置、Cloudflare Pages 前端部署和 Cloudflare Worker Auth API 部署。

---

## 目录

1. [前置要求](#前置要求)
2. [Supabase 配置](#supabase-配置)
3. [环境变量配置](#环境变量配置)
4. [Web 构建与部署](#web-构建与部署)
5. [缓存策略](#缓存策略)
6. [验证部署](#验证部署)
7. [常见问题](#常见问题)

---

## 前置要求

### 工具安装

```bash
# Node.js (>= 20.20.1)
node --version

# pnpm (workspace monorepo)
pnpm --version

# Supabase CLI
brew install supabase/tap/supabase
supabase --version

# Wrangler CLI (Cloudflare Workers / Pages)
pnpm add -g wrangler
wrangler --version
```

### 账号准备

- [Supabase](https://supabase.com) 账号
- [Cloudflare](https://dash.cloudflare.com) 账号

---

## Supabase 配置

### 1. 创建 Supabase 项目

1. 登录 [Supabase Dashboard](https://supabase.com/dashboard)
2. 点击 **New Project**
3. 填写：
   - **Name**: `werewolf-judge`（或自定义）
   - **Database Password**: 生成强密码并保存
   - **Region**: 选择离用户最近的区域（如 `West US`）
4. 点击 **Create new project**，等待 2-3 分钟

### 2. 登录 Supabase CLI

```bash
supabase login
# 浏览器会打开，授权后回到终端
```

### 3. Link 到远程项目

```bash
# 查看项目列表，获取 project-ref
supabase projects list

# 输出示例：
# LINKED | ORG ID | REFERENCE ID         | NAME              | REGION
# ●      | xxxxx  | abmzjezdvpzyeooqhhsn | WerewolfGameJudge | West US

# Link 到项目
cd /path/to/WerewolfGameJudge
supabase link --project-ref <your-project-ref>
```

### 4. 推送数据库迁移

```bash
supabase db push
```

这会创建：

- `rooms` 表（房间数据）
- RLS 安全策略
- Realtime 订阅配置
- 自动清理过期房间的函数

### 5. 启用匿名登录

1. 打开 [Authentication > Providers](https://supabase.com/dashboard/project/_/auth/providers)
2. 找到 **Anonymous Sign-ins**
3. 切换为 **Enabled**
4. 点击 **Save**

> ⚠️ 这是必须的，否则玩家无法加入房间。

### 6. 部署 Edge Functions

#### 6a. 游戏 API（game）

游戏逻辑由 `game` Edge Function 承载（CI 会在 merge 到 main 时自动部署）。首次部署或手动部署：

```bash
supabase functions deploy game
```

#### 6b. AI 代理（gemini-proxy）

```bash
# 设置 Gemini API key（服务端密钥，不会暴露到客户端）
supabase secrets set GEMINI_API_KEY=AIza...

# 部署 Edge Function
supabase functions deploy gemini-proxy
```

> AI 聊天功能通过 `gemini-proxy` Edge Function 代理 Gemini API（OpenAI 兼容层）。客户端只需知道 Supabase URL + anon key。

### 7. 获取 API Keys

```bash
supabase projects api-keys --project-ref <your-project-ref>

# 输出示例：
# NAME         | KEY VALUE
# anon         | eyJhbGciOiJIUzI1NiIs...（这是你需要的 key）
# service_role | eyJhbGciOiJIUzI1NiIs...（不要暴露这个）
```

或从 Dashboard 获取：

1. 打开 **Settings > API**
2. 复制 **Project URL** 和 **anon public** key

---

## 环境变量配置

项目遵循 Expo 社区标准的 `.env` 分层约定：

| 文件         | 用途     | Git 状态   | Supabase URL              |
| ------------ | -------- | ---------- | ------------------------- |
| `.env`       | 生产默认 | **已提交** | `https://xxx.supabase.co` |
| `.env.local` | 本地覆盖 | gitignored | `http://127.0.0.1:54321`  |

> Expo 加载优先级：`.env.local` > `.env`（[Expo 官方文档](https://docs.expo.dev/guides/environment-variables/)）。
>
> `EXPO_PUBLIC_*` 不是 secret —— 会 inline 到 JS bundle，客户端可见。Supabase anon key 是公开的（受 RLS 保护）。
>
> `EXPO_PUBLIC_GROQ_API_KEY` 已废弃 —— AI 功能改由 Supabase Edge Function 代理（`gemini-proxy`），Gemini API key 存储在服务端 secrets 中（`GEMINI_API_KEY`）。
> `EXPO_PUBLIC_SENTRY_DSN`（Sentry 崩溃报告）在 `.env` 中配置（公开值，与 anon key 同理）。

### 零配置开始

clone 后直接运行 —— `.env` 已在 git 中包含生产 Supabase 配置：

```bash
git clone <repo>
pnpm install
pnpm start
```

### 切换到本地 Supabase

```bash
supabase start
bash scripts/setup-local-env.sh
# 自动从 supabase status 读取 URL/Key，生成 .env.local
# 已有的非 Supabase 变量会自动保留
```

---

## Web 构建与部署

### 架构总览

| 组件                          | 平台                                               | 部署方式                                                                 |
| ----------------------------- | -------------------------------------------------- | ------------------------------------------------------------------------ |
| **前端**（Expo Web 静态资源） | Cloudflare Pages                                   | CI `deploy-frontend` job（`scripts/build.sh` + `wrangler pages deploy`） |
| **Auth API**（密码重置/登录） | Cloudflare Worker（`packages/api-worker`）         | CI `deploy-api-worker` job                                               |
| **游戏 API**（游戏逻辑权威）  | Supabase Edge Functions（`game` + `gemini-proxy`） | `scripts/deploy.sh`（手动应急）                                          |
| **AI 代理**                   | Supabase Edge Function（`gemini-proxy`）           | 同上                                                                     |

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

| 脚本                          | 职责                                               | 命令                     |
| ----------------------------- | -------------------------------------------------- | ------------------------ |
| `scripts/release.sh`          | 版本号 + CHANGELOG + commit + tag + push           | `pnpm run release`       |
| GitHub CI `deploy-frontend`   | 自动构建 + 部署到 Cloudflare Pages + 清除 CDN 缓存 | 自动                     |
| GitHub CI `deploy-api-worker` | 自动部署 Auth API Worker                           | 自动                     |
| `scripts/deploy.sh`           | **应急手动部署** Supabase Edge Functions           | `bash scripts/deploy.sh` |

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

### `deploy.sh` 做了什么（Supabase Edge Functions 应急部署）

1. 编译 game-engine ESM bundle
2. `supabase functions deploy game`
3. `supabase functions deploy gemini-proxy`

> ⚠️ `deploy.sh` 仅用于 Supabase Edge Functions，不涉及前端或 Auth API。日常部署通过 CI 自动完成。

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

### 2. 检查 Supabase 连接

- 点击「创建房间」
- 如果成功创建房间，说明数据库连接正常

### 3. 测试多设备同步

1. 在设备 A 创建房间，记录房间号
2. 在设备 B 输入房间号加入
3. 如果设备 B 能看到房间状态，说明 Realtime 正常

### 4. 检查匿名登录

- 无需注册即可创建/加入房间 ✓
- 如果提示「需要登录」，检查 Supabase 的匿名登录设置

---

## 常见问题

### Q1: `supabase db push` 失败

**原因**: 可能是网络问题或未 link 项目

**解决**:

```bash
# 重新 link
supabase link --project-ref <your-project-ref>

# 再次推送
supabase db push
```

### Q2: 部署后页面白屏

**可能原因**:

1. **CDN 缓存未清除** — CI 正常部署时会自动清除。手动部署后需手动清除：

   ```bash
   curl -sf -X POST \
     "https://api.cloudflare.com/client/v4/zones/<ZONE_ID>/purge_cache" \
     -H "Authorization: Bearer <API_TOKEN>" \
     -H "Content-Type: application/json" \
     --data '{"purge_everything":true}'
   ```

2. **构建时使用了本地 Supabase URL** — 检查构建产物：

   ```bash
   grep -o "supabase.co\|127.0.0.1" dist/assets/js/*.js
   # 应该输出 supabase.co，而不是 127.0.0.1
   ```

3. **Browser Cache TTL 设置错误** — 确认 Cloudflare Dashboard → Caching → Browser Cache TTL 为 **Respect Existing Headers**。

### Q3: Realtime 不工作（加入房间后看不到更新）

**原因**: Supabase Realtime 未启用

**解决**:

1. 打开 Supabase Dashboard > Database > Replication
2. 确保 `rooms` 表的 Realtime 已启用

### Q4: 如何更新部署？

```bash
pnpm run release    # 版本号 + CHANGELOG + commit + tag + push
# git push 自动触发 CI：deploy-frontend + deploy-api-worker
# Supabase Edge Functions 如需更新：bash scripts/deploy.sh
```

### Q5: 如何回滚？

```bash
# Cloudflare Pages 支持按 deployment 回滚：
# Dashboard → Pages → werewolfgamejudge → Deployments → 选择旧部署 → Rollback

# 或通过 wrangler CLI：
wrangler pages deployments list --project-name=werewolfgamejudge
wrangler pages deployments rollback --project-name=werewolfgamejudge <deployment-id>
```

---

## 快速参考

| 操作                    | 命令                                                     |
| ----------------------- | -------------------------------------------------------- |
| **本地开发**            |                                                          |
| 启动本地 Supabase       | `supabase start`                                         |
| 停止本地 Supabase       | `supabase stop`                                          |
| 启动开发服务器          | `pnpm start`                                             |
| **生产部署**            |                                                          |
| 发版                    | `pnpm run release` (patch) / `pnpm run release -- minor` |
| 前端 + Auth API 部署    | `git push` 自动触发 GitHub CI                            |
| 应急部署 Edge Functions | `bash scripts/deploy.sh`                                 |
| 全量质量检查            | `pnpm run quality`                                       |
| 推送数据库迁移          | `supabase db push`                                       |
| 部署游戏 API            | `supabase functions deploy game`（CI 无自动，手动执行）  |
| 部署 AI 代理            | `supabase functions deploy gemini-proxy`                 |
| 设置 Gemini 密钥        | `supabase secrets set GEMINI_API_KEY=AIza...`            |
| 获取 API Keys           | `supabase projects api-keys --project-ref <ref>`         |
| 清除 CDN 缓存           | CI 自动执行；手动见 Q2                                   |
| 回滚前端                | Cloudflare Pages Dashboard → Rollback                    |

---

## 当前生产环境

| 服务                   | URL                                                   |
| ---------------------- | ----------------------------------------------------- |
| **前端**（自定义域名） | https://werewolfjudge.eu.org                          |
| **前端**（Pages 默认） | https://werewolfgamejudge.pages.dev                   |
| **Auth API**           | https://api.werewolfjudge.eu.org（Cloudflare Worker） |
| **后端**               | https://abmzjezdvpzyeooqhhsn.supabase.co              |
| **游戏 API**           | Edge Function `game`                                  |
| **AI 代理**            | Edge Function `gemini-proxy`                          |
| **崩溃监控**           | Sentry                                                |
