/**
 * storageAdapter - 跨平台 storage adapter 工厂
 *
 * 根据运行环境探测并创建适合的 auth 持久化方案：
 * - Web 浏览器 → localStorage
 * - Native → AsyncStorage
 * - ?newUser=N URL 参数 → 隔离的内存 storage（开发多用户测试）
 *
 * 不包含业务逻辑、游戏状态操作，也不引入 service。
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

import { log } from '@/utils/logger';

const storageLog = log.extend('StorageAdapter');

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
    storageLog.warn('localStorage exists but is not usable (private mode / sandbox?)');
    return false;
  }
}

// Cache the detection result (只检测一次)
const localStorageAvailable = canUseLocalStorage();

/** Whether the runtime is a browser environment */
export const isBrowser = detectBrowserEnvironment();

// ============================================
// DEV TOOL: MULTI-USER TESTING
// ============================================

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

// ============================================
// STORAGE ADAPTER FACTORY
// ============================================

interface StorageAdapter {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
}

/**
 * Platform-specific storage adapter
 * - Web/Browser: use localStorage (works on mobile browsers)
 * - Native: use AsyncStorage
 * - With ?newUser=N: use isolated memory storage per slot (forces new anonymous user)
 */
export function getStorageAdapter(): StorageAdapter {
  const slot = getNewUserSlot();

  // Dev tool: ?newUser=N forces a fresh session in isolated memory slot
  if (slot !== null) {
    storageLog.debug(`Dev mode: ?newUser=${slot} detected, using isolated memory storage`);
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
    storageLog.debug('Using localStorage for auth storage');
    return {
      getItem: async (key: string): Promise<string | null> => {
        try {
          const value = globalThis.localStorage.getItem(key);
          return value;
        } catch (e) {
          storageLog.warn('localStorage.getItem failed:', e);
          return null;
        }
      },
      setItem: async (key: string, value: string): Promise<void> => {
        try {
          globalThis.localStorage.setItem(key, value);
        } catch (e) {
          storageLog.warn('localStorage.setItem failed:', e);
        }
      },
      removeItem: async (key: string): Promise<void> => {
        try {
          globalThis.localStorage.removeItem(key);
        } catch (e) {
          storageLog.warn('localStorage.removeItem failed:', e);
        }
      },
    };
  }
  // For native platforms, use AsyncStorage
  storageLog.debug('Using AsyncStorage for auth storage');
  return AsyncStorage;
}
