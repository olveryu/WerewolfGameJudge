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

## Environment Setup

Create a `.env` file in the project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

Get these values from **Settings > API** in your Supabase dashboard.

## Files

| File          | Purpose                                        |
| ------------- | ---------------------------------------------- |
| `config.toml` | Supabase CLI configuration                     |
| `migrations/` | Database migrations (versioned schema changes) |

## Creating New Migrations

```bash
# Create new migration
supabase migration new my_new_feature

# Edit the file in supabase/migrations/
# Then push
supabase db push
```
