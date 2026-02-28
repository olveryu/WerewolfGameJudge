/**
 * supabaseClient — Supabase client singleton
 *
 * Creates and exports the global SupabaseClient instance.
 * Relies on config values from `@/config/supabase` and runtime utilities
 * (storage adapter, logger). Only creates the client when Supabase is
 * properly configured; returns `null` otherwise (demo mode).
 *
 * Does not contain game/business logic.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

import { isSupabaseConfigured, SUPABASE_ANON_KEY, SUPABASE_URL } from '@/config/supabase';
import { log } from '@/utils/logger';
import { getStorageAdapter, isBrowser } from '@/utils/storageAdapter';

export { isSupabaseConfigured } from '@/config/supabase';

const supabaseLog = log.extend('Supabase');

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
    realtime: {
      // Offload heartbeat to Web Worker so it keeps running when the browser
      // throttles timers in backgrounded tabs. Prevents silent WebSocket drops.
      worker: true,
    },
  });
  supabaseLog.debug('Client initialized, isBrowser:', isBrowser);
} else {
  supabaseLog.debug('Not configured - running in demo mode');
}

export const supabase = supabaseClient;
