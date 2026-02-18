/**
 * supabase - Supabase client configuration
 *
 * 创建并导出全局 Supabase client 实例（SupabaseClient / isSupabaseConfigured）。
 * 支持环境变量和硬编码 fallback 两种配置方式。
 * 不包含业务逻辑或游戏状态操作。
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { log } from '@/utils/logger';
import { getStorageAdapter, isBrowser } from '@/utils/storageAdapter';

const supabaseLog = log.extend('Supabase');

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

// Check if Supabase is configured with valid credentials
export const isSupabaseConfigured = (): boolean => {
  return (
    SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
    SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY' &&
    (SUPABASE_URL.startsWith('https://') || SUPABASE_URL.startsWith('http://'))
  );
};

// Only create Supabase client if properly configured
// This prevents crashes when running in demo mode
let supabaseClient: SupabaseClient | null = null;

if (isSupabaseConfigured()) {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: getStorageAdapter(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      flowType: 'pkce', // More reliable for mobile browsers
    },
  });
  supabaseLog.debug('Client initialized, isBrowser:', isBrowser);
} else {
  supabaseLog.debug('Not configured - running in demo mode');
}

export const supabase = supabaseClient;
