# 🚀 部署指南

本文档覆盖从零到生产环境的完整部署流程，包括 Supabase 数据库配置和 Vercel 前端部署。

---

## 目录

1. [前置要求](#前置要求)
2. [Supabase 配置](#supabase-配置)
3. [环境变量配置](#环境变量配置)
4. [Web 构建与部署](#web-构建与部署)
5. [验证部署](#验证部署)
6. [常见问题](#常见问题)

---

## 前置要求

### 工具安装

```bash
# Node.js (>= 20.20.1)
node --version

# Supabase CLI
brew install supabase/tap/supabase
supabase --version

# Vercel CLI
npm install -g vercel
vercel --version
```

### 账号准备

- [Supabase](https://supabase.com) 账号
- [Vercel](https://vercel.com) 账号（可用 GitHub 登录）

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

### 职责分离

| 脚本                   | 职责                                                   | 命令               |
| ---------------------- | ------------------------------------------------------ | ------------------ |
| `scripts/release.sh`   | 版本号 + commit + tag + push                           | `pnpm run release` |
| Vercel Git Integration | `git push` 自动触发构建部署（执行 `scripts/build.sh`） | 自动               |
| `scripts/deploy.sh`    | **应急手动部署**（Vercel 自动部署故障时）              | `pnpm run deploy`  |

### 标准流程（推荐）

```bash
# 1. 发版（bump version → commit → tag → push）
pnpm run release              # 默认 patch
pnpm run release -- minor     # 或 minor / major

# 2. 部署自动完成
# git push 自动触发 Vercel Git Integration（执行 scripts/build.sh）
# 同时触发 GitHub CI（quality + deploy-edge-functions + E2E）
# 无需手动操作
```

> ⚠️ `pnpm run deploy`（`scripts/deploy.sh`）仅用于 Vercel 自动部署故障时的应急手动部署，日常不使用。

### `release.sh` 做了什么

1. `pnpm version patch` （或 minor/major）
2. 同步版本号到 `app.json`
3. 检测版本文件之外的改动，交互确认
4. `git commit -m "release: vX.Y.Z"` + `git tag vX.Y.Z`
5. `git push --tags`

### `deploy.sh` 做了什么

1. 校验 `.env` 存在（已提交到 git，包含生产 Supabase）
2. 临时移走 `.env.local`（让 `.env` 生效），保留 Gemini key
3. `npx expo export --platform web --clear`
4. 恢复 `.env.local`（`trap` 保护，即使构建失败也恢复）
5. 复制 PWA 文件、修复字体路径、注入自定义 `index.html`
6. 复制 `vercel.json`（SPA rewrites + 缓存头）
7. `vercel --prod` 部署 + 设置别名

### 手动部署

> ⚠️ 手动部署会缺少 PWA 文件复制、字体路径修复等步骤。建议优先使用 `pnpm run deploy`。

```bash
# 构建（确保 .env.local 不存在或不含 Supabase 本地值）
npx expo export --platform web --clear

# 验证
grep -o "supabase.co\|127.0.0.1" dist/_expo/static/js/web/*.js
# 应该输出 supabase.co，而不是 127.0.0.1

# 部署
cd dist && vercel --prod --yes
vercel alias <deployment-url> werewolf-judge.vercel.app
```

---

## 验证部署

### 1. 检查 Supabase 连接

访问 https://werewolf-judge.vercel.app：

- 点击「创建房间」
- 如果成功创建房间，说明数据库连接正常

### 2. 测试多设备同步

1. 在设备 A 创建房间，记录房间号
2. 在设备 B 输入房间号加入
3. 如果设备 B 能看到房间状态，说明 Realtime 正常

### 3. 检查匿名登录

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

### Q2: 部署后页面空白 / 手机上登录失败 (Load failed)

**原因**: 构建时 `.env.local` 未移走，使用了本地 `127.0.0.1`

**解决**:

```bash
# 检查构建中使用的 URL
grep -o "supabase.co\|127.0.0.1" dist/_expo/static/js/web/*.js

# 如果输出 127.0.0.1，重新部署即可：
pnpm run deploy
# deploy.sh 会自动移走 .env.local，使用 .env 中的生产值
```

### Q3: Realtime 不工作（加入房间后看不到更新）

**原因**: Supabase Realtime 未启用

**解决**:

1. 打开 Supabase Dashboard > Database > Replication
2. 确保 `rooms` 表的 Realtime 已启用

### Q4: 如何更新部署？

```bash
pnpm run release    # 版本号 + commit + tag + push
# git push 自动触发 Vercel Git Integration 部署
# 仅应急时才用: pnpm run deploy
```

### Q5: 如何回滚？

```bash
# 查看部署历史
vercel ls

# 将某个旧部署设为生产
vercel alias set <old-deployment-url> werewolf-judge.vercel.app
```

---

## 快速参考

| 操作              | 命令                                                     |
| ----------------- | -------------------------------------------------------- |
| **本地开发**      |                                                          |
| 启动本地 Supabase | `supabase start`                                         |
| 停止本地 Supabase | `supabase stop`                                          |
| 启动开发服务器    | `pnpm start`                                             |
| **生产部署**      |                                                          |
| 发版              | `pnpm run release` (patch) / `pnpm run release -- minor` |
| 部署              | `git push` 自动触发 Vercel Git Integration               |
| 应急手动部署      | `pnpm run deploy`（仅 Vercel 自动部署故障时）            |
| 全量质量检查      | `pnpm run quality`                                       |
| 推送数据库迁移    | `supabase db push`                                       |
| 部署游戏 API      | `supabase functions deploy game`（CI 自动，手动备用）    |
| 部署 AI 代理      | `supabase functions deploy gemini-proxy`                 |
| 设置 Gemini 密钥  | `supabase secrets set GEMINI_API_KEY=AIza...`            |
| 获取 API Keys     | `supabase projects api-keys --project-ref <ref>`         |
| 查看部署别名      | `vercel alias ls`                                        |
| 回滚部署          | `vercel alias set <old-url> werewolf-judge.vercel.app`   |

---

## 当前生产环境

| 服务         | URL                                      |
| ------------ | ---------------------------------------- |
| **前端**     | https://werewolf-judge.vercel.app        |
| **后端**     | https://abmzjezdvpzyeooqhhsn.supabase.co |
| **游戏 API** | Edge Function `game`                     |
| **AI 代理**  | Edge Function `gemini-proxy`             |
| **崩溃监控** | Sentry                                   |
