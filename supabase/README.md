# Supabase Database Setup

This project uses Supabase as the backend.

## Quick Setup with CLI

### 1. Install & Login

```bash
brew install supabase/tap/supabase
supabase login
```

### 2. Link to your project

```bash
# Get project ref from: https://supabase.com/dashboard/project/_/settings/general
supabase link --project-ref YOUR_PROJECT_REF
```

### 3. Apply migrations

```bash
supabase db push
```

This will create:

- `rooms` table with RLS policies
- `avatars` storage bucket with upload policies
- Auto-cleanup functions for inactive rooms
- Realtime subscriptions

## Manual Auth Setup (Required)

Some auth settings must be configured manually in the Dashboard:

### Enable Anonymous Sign-ins

1. Go to **Authentication > Settings**
2. Enable **Anonymous Sign-ins**
3. Click **Save**

> ⚠️ 这是必须的，否则玩家无法加入房间。本项目仅使用匿名登录，不需要 Email provider。

## Edge Functions

### game — 游戏 API

所有游戏逻辑由 `game` Edge Function 承载（服务端权威）。GitHub CI 的 `deploy-edge-functions` job 会在主分支自动部署。

```bash
supabase functions deploy game
```

### gemini-proxy — AI 聊天代理

客户端通过 Supabase Edge Function 代理 Gemini API（OpenAI 兼容层），避免在前端暴露 API Key。

```bash
# 设置 Gemini API Key（服务端密钥，不会暴露到客户端）
supabase secrets set GEMINI_API_KEY=<your-gemini-api-key>

# 部署 Edge Function
supabase functions deploy gemini-proxy
```

验证部署：

```bash
supabase functions list
# 应看到 gemini-proxy 状态为 Active
```

> 客户端只需 Supabase URL + anon key 即可调用，无需知道 Gemini API Key。

如需本地核验完整流程，建议先运行：

```bash
pnpm run quality
```

## Environment Setup

`.env`（已提交到 git）包含生产 Supabase 配置，clone 后即可使用。

如需连接本地 Supabase，运行：

```bash
supabase start
bash scripts/setup-local-env.sh
```

这会生成 `.env.local` 覆盖 `.env` 中的 Supabase 值（Expo 优先加载 `.env.local`）。

## Files

| File          | Purpose                                        |
| ------------- | ---------------------------------------------- |
| `config.toml` | Supabase CLI configuration                     |
| `functions/`  | Edge Functions (`game`, `gemini-proxy`)        |
| `migrations/` | Database migrations (versioned schema changes) |

## Creating New Migrations

```bash
# Create new migration
supabase migration new my_new_feature

# Edit the file in supabase/migrations/
# Then push
supabase db push
```
