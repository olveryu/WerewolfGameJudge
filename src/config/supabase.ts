import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

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

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// Check if Supabase is configured with valid credentials
export const isSupabaseConfigured = (): boolean => {
  return SUPABASE_URL !== 'YOUR_SUPABASE_URL' && 
         SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY' &&
         (SUPABASE_URL.startsWith('https://') || SUPABASE_URL.startsWith('http://'));
};

// Only create Supabase client if properly configured
// This prevents crashes when running in demo mode
let supabaseClient: SupabaseClient | null = null;

if (isSupabaseConfigured()) {
  supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  console.log('Supabase client initialized');
} else {
  console.log('Supabase not configured - running in demo mode');
}

export const supabase = supabaseClient;
export default supabase;
