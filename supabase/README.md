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

### Enable Auth Providers

1. Go to **Authentication > Providers**
2. Enable **Email** provider:
   - ✅ Enable Email Signup
   - ✅ Confirm email (optional, can disable for testing)
3. Enable **Anonymous Sign-ins**:
   - Go to **Authentication > Settings**
   - ✅ Enable anonymous sign-ins

### (Optional) Configure Email Templates

Go to **Authentication > Email Templates** to customize:

- Confirmation email
- Password reset email

## Edge Functions

### groq-proxy — AI 聊天代理

客户端通过 Supabase Edge Function 代理 Groq API，避免在前端暴露 API Key。

```bash
# 设置 GROQ API Key（服务端密钥，不会暴露到客户端）
supabase secrets set GROQ_API_KEY=<your-groq-api-key>

# 部署 Edge Function
supabase functions deploy groq-proxy
```

验证部署：

```bash
supabase functions list
# 应看到 groq-proxy 状态为 Active
```

> 客户端只需 Supabase URL + anon key 即可调用，无需知道 GROQ API Key。

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
| `functions/`  | Edge Functions (groq-proxy 等)                  |
| `migrations/` | Database migrations (versioned schema changes) |

## Creating New Migrations

```bash
# Create new migration
supabase migration new my_new_feature

# Edit the file in supabase/migrations/
# Then push
supabase db push
```
