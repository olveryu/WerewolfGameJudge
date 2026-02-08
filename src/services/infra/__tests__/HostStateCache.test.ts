/**
 * HostStateCache Unit Tests
 *
 * 测试结构校验、版本检查、过期清理、roomCode:hostUid 误命中防护
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { HostStateCache, CachedHostState } from '@/services/infra/HostStateCache';
import type { BroadcastGameState } from '@/services/protocol/types';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('HostStateCache', () => {
  const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

  const ROOM_CODE = '1234';
  const HOST_UID = 'host-1';
  const CACHE_KEY = `host_state_cache_${ROOM_CODE}:${HOST_UID}`;

  beforeEach(() => {
    jest.clearAllMocks();
    HostStateCache.resetInstance();
  });

  const createMinimalState = (overrides?: Partial<BroadcastGameState>): BroadcastGameState => ({
    roomCode: ROOM_CODE,
    hostUid: HOST_UID,
    status: 'unseated',
    templateRoles: ['villager', 'wolf', 'seer'],
    players: { 0: null, 1: null, 2: null },
    currentStepIndex: -1,
    isAudioPlaying: false,
    ...overrides,
  });

  const createValidCached = (overrides?: Partial<CachedHostState>): CachedHostState => ({
    version: 1,
    state: createMinimalState(),
    revision: 10,
    cachedAt: Date.now(),
    ...overrides,
  });

  // =========================================================================
  // saveState
  // =========================================================================
  describe('saveState', () => {
    it('should save state with key = roomCode:hostUid', async () => {
      const cache = HostStateCache.getInstance();
      const state = createMinimalState();

      await cache.saveState(ROOM_CODE, HOST_UID, state, 5);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(CACHE_KEY, expect.any(String));

      const savedData = JSON.parse(mockAsyncStorage.setItem.mock.calls[0][1]);
      expect(savedData.version).toBe(1);
      expect(savedData.state).toEqual(state);
      expect(savedData.revision).toBe(5);
      expect(typeof savedData.cachedAt).toBe('number');
    });
  });

  // =========================================================================
  // loadState - happy path
  // =========================================================================
  describe('loadState (happy path)', () => {
    it('should return null if no cache exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValue(null);

      const cache = HostStateCache.getInstance();
      const result = await cache.loadState(ROOM_CODE, HOST_UID);

      expect(result).toBeNull();
      expect(mockAsyncStorage.removeItem).not.toHaveBeenCalled();
    });

    it('should return cached state if valid', async () => {
      const cached = createValidCached();
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(cached));

      const cache = HostStateCache.getInstance();
      const result = await cache.loadState(ROOM_CODE, HOST_UID);

      expect(result).not.toBeNull();
      expect(result!.state.roomCode).toBe(ROOM_CODE);
      expect(result!.state.hostUid).toBe(HOST_UID);
      expect(result!.revision).toBe(10);
      expect(mockAsyncStorage.removeItem).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // loadState - structure validation (strict: removeItem + return null)
  // =========================================================================
  describe('loadState structure validation', () => {
    it('should return null and removeItem when JSON is invalid', async () => {
      mockAsyncStorage.getItem.mockResolvedValue('{ invalid json !!!');

      const cache = HostStateCache.getInstance();
      const result = await cache.loadState(ROOM_CODE, HOST_UID);

      expect(result).toBeNull();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(CACHE_KEY);
    });

    it('should return null and removeItem when version field is missing', async () => {
      const incompleteData = {
        // missing version
        state: createMinimalState(),
        revision: 10,
        cachedAt: Date.now(),
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(incompleteData));

      const cache = HostStateCache.getInstance();
      const result = await cache.loadState(ROOM_CODE, HOST_UID);

      expect(result).toBeNull();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(CACHE_KEY);
    });

    it('should return null and removeItem when state field is missing', async () => {
      const incompleteData = {
        version: 1,
        // missing state
        revision: 10,
        cachedAt: Date.now(),
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(incompleteData));

      const cache = HostStateCache.getInstance();
      const result = await cache.loadState(ROOM_CODE, HOST_UID);

      expect(result).toBeNull();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(CACHE_KEY);
    });

    it('should return null and removeItem when revision field is missing', async () => {
      const incompleteData = {
        version: 1,
        state: createMinimalState(),
        // missing revision
        cachedAt: Date.now(),
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(incompleteData));

      const cache = HostStateCache.getInstance();
      const result = await cache.loadState(ROOM_CODE, HOST_UID);

      expect(result).toBeNull();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(CACHE_KEY);
    });

    it('should return null and removeItem when cachedAt field is missing', async () => {
      const incompleteData = {
        version: 1,
        state: createMinimalState(),
        revision: 10,
        // missing cachedAt
      };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(incompleteData));

      const cache = HostStateCache.getInstance();
      const result = await cache.loadState(ROOM_CODE, HOST_UID);

      expect(result).toBeNull();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(CACHE_KEY);
    });

    it('should return null and removeItem when state.roomCode is missing', async () => {
      const badState = { hostUid: HOST_UID, status: 'unseated' } as BroadcastGameState;
      const cached = { version: 1, state: badState, revision: 10, cachedAt: Date.now() };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(cached));

      const cache = HostStateCache.getInstance();
      const result = await cache.loadState(ROOM_CODE, HOST_UID);

      expect(result).toBeNull();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(CACHE_KEY);
    });

    it('should return null and removeItem when state.hostUid is missing', async () => {
      const badState = { roomCode: ROOM_CODE, status: 'unseated' } as BroadcastGameState;
      const cached = { version: 1, state: badState, revision: 10, cachedAt: Date.now() };
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(cached));

      const cache = HostStateCache.getInstance();
      const result = await cache.loadState(ROOM_CODE, HOST_UID);

      expect(result).toBeNull();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(CACHE_KEY);
    });

    it('should return null and removeItem when version mismatch', async () => {
      const cached = createValidCached({ version: 999 });
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(cached));

      const cache = HostStateCache.getInstance();
      const result = await cache.loadState(ROOM_CODE, HOST_UID);

      expect(result).toBeNull();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(CACHE_KEY);
    });
  });

  // =========================================================================
  // loadState - expiry
  // =========================================================================
  describe('loadState expiry', () => {
    it('should return null and removeItem when cache is expired (> 24 hours)', async () => {
      const cached = createValidCached({
        cachedAt: Date.now() - 25 * 60 * 60 * 1000, // 25 hours ago
      });
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(cached));

      const cache = HostStateCache.getInstance();
      const result = await cache.loadState(ROOM_CODE, HOST_UID);

      expect(result).toBeNull();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(CACHE_KEY);
    });

    it('should return cached state if not expired (< 24 hours)', async () => {
      const cached = createValidCached({
        cachedAt: Date.now() - 12 * 60 * 60 * 1000, // 12 hours ago
      });
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(cached));

      const cache = HostStateCache.getInstance();
      const result = await cache.loadState(ROOM_CODE, HOST_UID);

      expect(result).not.toBeNull();
      expect(mockAsyncStorage.removeItem).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // loadState - roomCode/hostUid mismatch (防 roomCode 复用误命中)
  // =========================================================================
  describe('loadState roomCode/hostUid mismatch guard', () => {
    it('should return null and removeItem when cached state.roomCode mismatches request', async () => {
      const cached = createValidCached({
        state: createMinimalState({ roomCode: 'DIFFERENT' }),
      });
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(cached));

      const cache = HostStateCache.getInstance();
      const result = await cache.loadState(ROOM_CODE, HOST_UID);

      expect(result).toBeNull();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(CACHE_KEY);
    });

    it('should return null and removeItem when cached state.hostUid mismatches request', async () => {
      const cached = createValidCached({
        state: createMinimalState({ hostUid: 'different-host' }),
      });
      mockAsyncStorage.getItem.mockResolvedValue(JSON.stringify(cached));

      const cache = HostStateCache.getInstance();
      const result = await cache.loadState(ROOM_CODE, HOST_UID);

      expect(result).toBeNull();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(CACHE_KEY);
    });
  });

  // =========================================================================
  // clearState
  // =========================================================================
  describe('clearState', () => {
    it('should remove cache from AsyncStorage with correct key', async () => {
      const cache = HostStateCache.getInstance();

      await cache.clearState(ROOM_CODE, HOST_UID);

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith(CACHE_KEY);
    });
  });
});
