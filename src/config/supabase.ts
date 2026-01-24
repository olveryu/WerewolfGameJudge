import { createClient, SupabaseClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { log } from '../utils/logger';

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

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// Check if Supabase is configured with valid credentials
export const isSupabaseConfigured = (): boolean => {
  return (
    SUPABASE_URL !== 'YOUR_SUPABASE_URL' &&
    SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY' &&
    (SUPABASE_URL.startsWith('https://') || SUPABASE_URL.startsWith('http://'))
  );
};

// ============================================
// ENVIRONMENT DETECTION (稳健探测)
// ============================================

/**
 * 探测是否在浏览器环境中运行
 * 考虑 SSR / RN / JSDOM / WebView 等边缘情况
 */
function detectBrowserEnvironment(): boolean {
  // 检查 window 对象存在
  if (globalThis.window === undefined) return false;
  // 检查 localStorage API 存在
  if (globalThis.window.localStorage === undefined) return false;
  return true;
}

/**
 * 测试 localStorage 是否真正可用（不仅仅存在）
 * 某些环境（隐私模式、iframe 沙箱等）localStorage 存在但不可写
 */
function canUseLocalStorage(): boolean {
  if (!detectBrowserEnvironment()) return false;

  const testKey = '__supabase_storage_test__';
  try {
    globalThis.localStorage.setItem(testKey, 'test');
    globalThis.localStorage.removeItem(testKey);
    return true;
  } catch {
    supabaseLog.warn('localStorage exists but is not usable (private mode / sandbox?)');
    return false;
  }
}

// Cache the detection result (只检测一次)
const isBrowser = detectBrowserEnvironment();
const localStorageAvailable = canUseLocalStorage();

// Check for ?newUser=N URL parameter (dev tool for multi-user testing)
// Each different N value gets a separate isolated session
// Usage: ?newUser=1, ?newUser=2, ?newUser=3, etc.
const getNewUserSlot = (): number | null => {
  if (!isBrowser) return null;
  try {
    const params = new URLSearchParams(globalThis.window.location.search);
    const value = params.get('newUser');
    if (value) {
      const slot = Number.parseInt(value, 10);
      return Number.isNaN(slot) ? 1 : slot; // default to slot 1 if not a number
    }
    return null;
  } catch {
    return null;
  }
};

// Isolated memory stores for each newUser slot (dev testing)
const memoryStores: Record<number, Record<string, string>> = {};

// Platform-specific storage adapter
// - Web/Browser: use localStorage (works on mobile browsers)
// - Native: use AsyncStorage
// - With ?newUser=N: use isolated memory storage per slot (forces new anonymous user)
const getStorageAdapter = () => {
  const slot = getNewUserSlot();

  // Dev tool: ?newUser=N forces a fresh session in isolated memory slot
  if (slot !== null) {
    supabaseLog.debug(`Dev mode: ?newUser=${slot} detected, using isolated memory storage`);
    if (!memoryStores[slot]) {
      memoryStores[slot] = {};
    }
    const memoryStore = memoryStores[slot];
    return {
      getItem: async (key: string): Promise<string | null> => memoryStore[key] || null,
      setItem: async (key: string, value: string): Promise<void> => {
        memoryStore[key] = value;
      },
      removeItem: async (key: string): Promise<void> => {
        delete memoryStore[key];
      },
    };
  }

  if (localStorageAvailable) {
    // For web (including mobile browsers), use localStorage
    supabaseLog.debug('Using localStorage for auth storage');
    return {
      getItem: async (key: string): Promise<string | null> => {
        try {
          const value = globalThis.localStorage.getItem(key);
          return value;
        } catch (e) {
          supabaseLog.warn('localStorage.getItem failed:', e);
          return null;
        }
      },
      setItem: async (key: string, value: string): Promise<void> => {
        try {
          globalThis.localStorage.setItem(key, value);
        } catch (e) {
          supabaseLog.warn('localStorage.setItem failed:', e);
        }
      },
      removeItem: async (key: string): Promise<void> => {
        try {
          globalThis.localStorage.removeItem(key);
        } catch (e) {
          supabaseLog.warn('localStorage.removeItem failed:', e);
        }
      },
    };
  }
  // For native platforms, use AsyncStorage
  supabaseLog.debug('Using AsyncStorage for auth storage');
  return AsyncStorage;
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
export default supabase;
