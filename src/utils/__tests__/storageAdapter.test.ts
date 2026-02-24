/**
 * storageAdapter.test.ts — 跨平台 storage adapter 工厂
 *
 * 测试核心分支：
 * - 环境探测（browser / native / 隐私模式）
 * - ?newUser=N 隔离内存 storage（NaN fallback、slot 隔离）
 * - localStorage adapter 的 CRUD + silent catch
 * - 非浏览器环境回退到 AsyncStorage
 *
 * 使用 jest.isolateModules + require() 在不同环境下重新加载模块级缓存。
 */

// Save originals before any module loads
const originalWindow = globalThis.window;
const originalLocalStorage = globalThis.localStorage;

describe('storageAdapter', () => {
  afterEach(() => {
    jest.resetModules();
    // Restore originals
    Object.defineProperty(globalThis, 'window', {
      value: originalWindow,
      writable: true,
      configurable: true,
    });
    if (originalLocalStorage) {
      Object.defineProperty(globalThis, 'localStorage', {
        value: originalLocalStorage,
        writable: true,
        configurable: true,
      });
    }
  });

  // Helper: require storageAdapter in an isolated module scope
  function requireIsolated(): { getStorageAdapter: () => any; isBrowser: boolean } {
    let mod: any;
    jest.isolateModules(() => {
      mod = require('@/utils/storageAdapter');
    });
    return mod!;
  }

  // =========================================================================
  // Native environment (no window.localStorage)
  // =========================================================================
  describe('native environment (no localStorage)', () => {
    it('should return AsyncStorage when localStorage is unavailable', async () => {
      // Simulate native: localStorage unavailable
      const fakeWindow = {} as Window & typeof globalThis;
      Object.defineProperty(globalThis, 'window', {
        value: fakeWindow,
        writable: true,
        configurable: true,
      });

      const { getStorageAdapter, isBrowser } = requireIsolated();

      // isBrowser should be false (no localStorage on window)
      expect(isBrowser).toBe(false);

      const adapter = getStorageAdapter();

      // Should be AsyncStorage (has the same interface)
      await adapter.setItem('testKey', 'testValue');
      const value = await adapter.getItem('testKey');
      expect(value).toBe('testValue');

      await adapter.removeItem('testKey');
      const removed = await adapter.getItem('testKey');
      expect(removed).toBeNull();
    });
  });

  // =========================================================================
  // Browser environment with working localStorage
  // =========================================================================
  describe('browser environment with localStorage', () => {
    let mockStorage: Record<string, string>;

    beforeEach(() => {
      mockStorage = {};
      const mockLS = {
        getItem: jest.fn((key: string) => mockStorage[key] ?? null),
        setItem: jest.fn((key: string, value: string) => {
          mockStorage[key] = value;
        }),
        removeItem: jest.fn((key: string) => {
          delete mockStorage[key];
        }),
        clear: jest.fn(),
        length: 0,
        key: jest.fn(),
      };

      Object.defineProperty(globalThis, 'window', {
        value: { localStorage: mockLS, location: { search: '' } },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(globalThis, 'localStorage', {
        value: mockLS,
        writable: true,
        configurable: true,
      });
    });

    it('should use localStorage adapter and perform CRUD correctly', async () => {
      const { getStorageAdapter } = requireIsolated();
      const adapter = getStorageAdapter();

      await adapter.setItem('auth_token', 'abc123');
      const value = await adapter.getItem('auth_token');
      expect(value).toBe('abc123');

      await adapter.removeItem('auth_token');
      const removed = await adapter.getItem('auth_token');
      expect(removed).toBeNull();
    });

    it('should return null on getItem when localStorage.getItem throws', async () => {
      // Override getItem to throw (simulates quota exceeded, etc.)
      (globalThis.localStorage.getItem as jest.Mock).mockImplementation(() => {
        throw new Error('SecurityError');
      });

      const { getStorageAdapter } = requireIsolated();
      const adapter = getStorageAdapter();

      const value = await adapter.getItem('any_key');
      expect(value).toBeNull();
    });

    it('should silently swallow setItem errors', async () => {
      (globalThis.localStorage.setItem as jest.Mock).mockImplementation(() => {
        throw new Error('QuotaExceededError');
      });

      const { getStorageAdapter } = requireIsolated();
      const adapter = getStorageAdapter();

      // Should not throw
      await expect(adapter.setItem('key', 'val')).resolves.toBeUndefined();
    });

    it('should silently swallow removeItem errors', async () => {
      (globalThis.localStorage.removeItem as jest.Mock).mockImplementation(() => {
        throw new Error('SecurityError');
      });

      const { getStorageAdapter } = requireIsolated();
      const adapter = getStorageAdapter();

      await expect(adapter.removeItem('key')).resolves.toBeUndefined();
    });
  });

  // =========================================================================
  // Browser with broken localStorage (private browsing / sandbox)
  // =========================================================================
  describe('browser with broken localStorage', () => {
    it('should fall back to AsyncStorage when localStorage throws on write', async () => {
      const brokenLS = {
        getItem: jest.fn(),
        setItem: jest.fn(() => {
          throw new Error('QuotaExceededError');
        }),
        removeItem: jest.fn(),
        clear: jest.fn(),
        length: 0,
        key: jest.fn(),
      };

      Object.defineProperty(globalThis, 'window', {
        value: { localStorage: brokenLS, location: { search: '' } },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(globalThis, 'localStorage', {
        value: brokenLS,
        writable: true,
        configurable: true,
      });

      const { getStorageAdapter } = requireIsolated();
      const adapter = getStorageAdapter();

      // Should fall back to AsyncStorage
      await adapter.setItem('test', 'val');
      const val = await adapter.getItem('test');
      expect(val).toBe('val');
    });
  });

  // =========================================================================
  // ?newUser=N isolated memory storage
  // =========================================================================
  describe('?newUser=N dev tool', () => {
    function setupBrowserWithSearch(search: string) {
      const mockLS = {
        getItem: jest.fn(),
        setItem: jest.fn(),
        removeItem: jest.fn(),
        clear: jest.fn(),
        length: 0,
        key: jest.fn(),
      };

      Object.defineProperty(globalThis, 'window', {
        value: { localStorage: mockLS, location: { search } },
        writable: true,
        configurable: true,
      });
      Object.defineProperty(globalThis, 'localStorage', {
        value: mockLS,
        writable: true,
        configurable: true,
      });
    }

    it('should use isolated memory storage for ?newUser=1', async () => {
      setupBrowserWithSearch('?newUser=1');

      const { getStorageAdapter } = requireIsolated();
      const adapter = getStorageAdapter();

      await adapter.setItem('token', 'user1-token');
      const val = await adapter.getItem('token');
      expect(val).toBe('user1-token');

      await adapter.removeItem('token');
      const removed = await adapter.getItem('token');
      expect(removed).toBeNull();
    });

    it('should default to slot 1 when ?newUser=abc (NaN)', async () => {
      setupBrowserWithSearch('?newUser=abc');

      const { getStorageAdapter } = requireIsolated();
      const adapter = getStorageAdapter();

      // Should not throw — NaN defaults to slot 1
      await adapter.setItem('key', 'value');
      expect(await adapter.getItem('key')).toBe('value');
    });

    it('should return null for missing keys in memory storage', async () => {
      setupBrowserWithSearch('?newUser=5');

      const { getStorageAdapter } = requireIsolated();
      const adapter = getStorageAdapter();

      expect(await adapter.getItem('nonexistent')).toBeNull();
    });
  });
});
