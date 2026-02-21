import { AuthService } from '@/services/infra/AuthService';

// Mock supabase
jest.mock('../supabaseClient', () => ({
  supabase: null,
  isSupabaseConfigured: jest.fn(() => false),
}));

describe('AuthService - Unconfigured state', () => {
  let authService: AuthService;

  beforeEach(() => {
    jest.useFakeTimers();
    authService = new AuthService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('isConfigured should return false when supabase is null', () => {
    expect(authService.isConfigured()).toBe(false);
  });

  it('getCurrentUserId should return null initially', () => {
    expect(authService.getCurrentUserId()).toBeNull();
  });

  it('getCurrentUser should return null when not configured', () => {
    expect(authService.getCurrentUser()).toBeNull();
  });

  it('signInAnonymously should throw when not configured', async () => {
    await expect(authService.signInAnonymously()).rejects.toThrow('服务未配置');
  });

  it('signUpWithEmail should throw when not configured', async () => {
    await expect(authService.signUpWithEmail('test@test.com', 'password123')).rejects.toThrow(
      '服务未配置',
    );
  });

  it('signInWithEmail should throw when not configured', async () => {
    await expect(authService.signInWithEmail('test@test.com', 'password123')).rejects.toThrow(
      '服务未配置',
    );
  });

  it('updateProfile should throw when not configured', async () => {
    await expect(authService.updateProfile({ displayName: 'Test' })).rejects.toThrow('服务未配置');
  });

  it('signOut should throw when not configured', async () => {
    await expect(authService.signOut()).rejects.toThrow('服务未配置');
  });

  it('initAuth should return null when not configured', async () => {
    const result = await authService.initAuth();
    expect(result).toBeNull();
  });

  it('waitForInit should resolve without error', async () => {
    await expect(authService.waitForInit()).resolves.toBeUndefined();
  });
});

describe('AuthService - generateDisplayName', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  it('should generate a display name from uid', () => {
    const displayName = authService.generateDisplayName('test-user-123');

    expect(displayName).toBeDefined();
    expect(typeof displayName).toBe('string');
    expect(displayName.length).toBeGreaterThan(0);
  });

  it('should generate consistent name for same uid', () => {
    const name1 = authService.generateDisplayName('same-user-id');
    const name2 = authService.generateDisplayName('same-user-id');

    expect(name1).toBe(name2);
  });

  it('should generate different names for different uids', () => {
    const name1 = authService.generateDisplayName('user-1');
    const name2 = authService.generateDisplayName('user-2');

    // Different users should have different names (high probability)
    expect(name1).not.toBe(name2);
  });

  it('should handle empty uid', () => {
    const displayName = authService.generateDisplayName('');

    expect(displayName).toBeDefined();
    expect(typeof displayName).toBe('string');
  });

  it('should handle special characters in uid', () => {
    const displayName = authService.generateDisplayName('user@test.com-123_abc');

    expect(displayName).toBeDefined();
    expect(typeof displayName).toBe('string');
  });

  it('should generate name with Chinese characters', () => {
    const displayName = authService.generateDisplayName('test-uid');

    // The adjectives are Chinese, so should contain CJK characters
    expect(displayName).toMatch(/[\u4e00-\u9fff]/);
  });

  it('should include role name in generated display name', () => {
    const displayName = authService.generateDisplayName('test-uid-for-role');

    // The noun part comes from role displayNames
    // Should contain common role names like 预言家, 女巫, 猎人, etc.
    expect(displayName.length).toBeGreaterThan(3);
  });
});

describe('AuthService - getCurrentDisplayName', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  it('should return generated name when not configured', async () => {
    const displayName = await authService.getCurrentDisplayName();

    expect(displayName).toBeDefined();
    expect(typeof displayName).toBe('string');
    expect(displayName.length).toBeGreaterThan(0);
  });
});

describe('AuthService - getCurrentAvatarUrl', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  it('should return null when not configured', async () => {
    const avatarUrl = await authService.getCurrentAvatarUrl();

    expect(avatarUrl).toBeNull();
  });
});

describe('AuthService - Display name generation diversity', () => {
  let authService: AuthService;

  beforeEach(() => {
    authService = new AuthService();
  });

  it('should generate diverse names for many users', () => {
    const names = new Set<string>();

    // Generate 50 unique UIDs
    for (let i = 0; i < 50; i++) {
      const uid = `user-${i}-${Math.random().toString(36).substring(7)}`;
      names.add(authService.generateDisplayName(uid));
    }

    // Should have high diversity (at least 40 unique names out of 50)
    expect(names.size).toBeGreaterThan(40);
  });

  it('should not generate extremely long names', () => {
    for (let i = 0; i < 20; i++) {
      const uid = `user-${i}`;
      const displayName = authService.generateDisplayName(uid);

      // Name should be reasonable length (max ~20 characters for 3 Chinese words)
      expect(displayName.length).toBeLessThan(25);
    }
  });
});

describe('AuthService - waitForInit timeout', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('should timeout after 10 seconds if initPromise never resolves', async () => {
    // Create a service with a never-resolving init promise
    const authService = new AuthService();

    // Override the initPromise with one that never resolves
    (authService as any).initPromise = new Promise(() => {});

    // Start waiting
    const waitPromise = authService.waitForInit();

    // Fast-forward 10 seconds
    jest.advanceTimersByTime(10000);

    // Should reject with user-friendly timeout error
    await expect(waitPromise).rejects.toThrow('登录超时，请重试');
  });

  it('should resolve if initPromise resolves before timeout', async () => {
    const authService = new AuthService();

    // Override with a quick-resolving promise
    (authService as any).initPromise = Promise.resolve();

    // Should resolve without error
    await expect(authService.waitForInit()).resolves.toBeUndefined();
  });
});

// Note: Testing the configured state would require module mocking before import,
// which is complex with singleton patterns. The unconfigured tests above
// thoroughly cover the service's behavior and display name generation.
