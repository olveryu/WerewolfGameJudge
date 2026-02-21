/**
 * supabase — Supabase configuration values
 *
 * Pure config: URL, anon key, and configured check.
 * Client creation lives in `@/services/infra/supabaseClient`.
 * 禁止业务逻辑/副作用。
 */

// ============================================
// SUPABASE CONFIGURATION
// ============================================
//
// To set up Supabase:
// 1. Go to https://supabase.com and create a free account
// 2. Create a new project
// 3. Go to Settings > API
// 4. Copy your Project URL and anon/public key
// 5. Replace the values below or set environment variables
//
// ============================================

export const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
export const SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

/** Check if Supabase is configured with valid credentials */
export const isSupabaseConfigured = (): boolean => {
  return (
    SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
    SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY' &&
    (SUPABASE_URL.startsWith('https://') || SUPABASE_URL.startsWith('http://'))
  );
};
