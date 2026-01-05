# Supabase Setup Guide

This guide will help you set up Supabase for real-time multi-player support.

## 1. Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Click "Start your project" and sign up/login
3. Click "New project"
4. Fill in:
   - **Name**: `werewolf-judge` (or any name)
   - **Database Password**: Generate a strong password
   - **Region**: Choose closest to your users
5. Click "Create new project" and wait for setup (~2 minutes)

## 2. Set Up the Database

1. In your Supabase dashboard, go to **SQL Editor**
2. Click "New query"
3. Copy the contents of `supabase/schema.sql` from this project
4. Paste into the SQL Editor
5. Click "Run" to execute

This creates:
- `rooms` table with proper columns
- Row Level Security policies
- Real-time subscriptions
- Auto-cleanup for old rooms

## 3. Enable Anonymous Authentication

1. Go to **Authentication** > **Providers**
2. Find "Anonymous" and enable it
3. This allows players to join without creating an account

## 4. Get Your API Keys

1. Go to **Settings** > **API**
2. Copy:
   - **Project URL**: `https://xxxxx.supabase.co`
   - **anon/public key**: `eyJhbGciOiJI...`

## 5. Configure Your App

### Option A: Environment Variables (Recommended)

Create a `.env` file in your project root:

```env
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here
```

### Option B: Direct Configuration

Edit `src/config/supabase.ts`:

```typescript
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key-here';
```

## 6. Test the Connection

1. Start your app: `npm start`
2. Create a room - it should now persist!
3. Open another browser/device and join with the room code

## Troubleshooting

### Room not working / App in demo mode
- Check that your `.env` file is in the project root
- Restart the Expo server after adding `.env`
- Verify the URL starts with `https://`

### "Room not found" when joining
- Verify the database table was created correctly
- Check the Supabase logs for errors
- Ensure RLS policies are set up

### Real-time updates not working
- Make sure `ALTER PUBLICATION supabase_realtime ADD TABLE rooms;` was run
- Check browser console for WebSocket errors

## Free Tier Limits

Supabase free tier includes:
- 500MB database storage
- 2GB bandwidth per month
- 50,000 monthly active users
- Unlimited API requests

This is plenty for a Werewolf game app!

## Security Notes

The current setup allows anyone to update rooms. For production, consider:
- Adding player validation
- Restricting updates to seated players only
- Adding rate limiting
