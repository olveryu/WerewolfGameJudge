/**
 * Storage Unit Tests
 *
 * 测试覆盖范围：
 * - 状态保存 (save)
 * - 状态加载 (load)
 * - 状态清除 (clear)
 * - 状态过期检查
 * - Map 序列化/反序列化
 */

import { Storage } from '../../infra/Storage';
import { GameStatus } from '../../infra/StateStore';
import type { LocalGameState, LocalPlayer } from '../../infra/StateStore';
import type { RoleId } from '../../../../models/roles';
import type { RoleAction } from '../../../../models/actions';
import { makeActionTarget } from '../../../../models/actions';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockPlayer(seat: number, role: RoleId | null = null): LocalPlayer {
  return {
    uid: `player_${seat}`,
    seatNumber: seat,
    displayName: `Player ${seat}`,
    avatarUrl: undefined,
    role,
    hasViewedRole: false,
  };
}

function createMockState(roomCode: string = 'TEST01'): LocalGameState {
  const players = new Map<number, LocalPlayer | null>();
  players.set(0, createMockPlayer(0, 'wolf'));
  players.set(1, createMockPlayer(1, 'seer'));
  players.set(2, createMockPlayer(2, 'villager'));

  const actions = new Map<RoleId, RoleAction>();
  actions.set('wolf', makeActionTarget(2));
  actions.set('seer', makeActionTarget(0));

  const wolfVotes = new Map<number, number>();
  wolfVotes.set(0, 2);

  return {
    roomCode,
    hostUid: 'host_uid',
    status: GameStatus.ongoing,
    template: {
      name: 'Test Template',
      numberOfPlayers: 3,
      roles: ['wolf', 'seer', 'villager'] as RoleId[],
    },
    players,
    actions,
    wolfVotes,
    currentActionerIndex: 1,
    isAudioPlaying: false,
    lastNightDeaths: [2],
    currentNightResults: { wolfKillTarget: 2 },
  };
}

// =============================================================================
// Tests
// =============================================================================

describe('Storage', () => {
  let storage: Storage;

  beforeEach(async () => {
    await AsyncStorage.clear();
    Storage.resetInstance();
    storage = Storage.getInstance();
  });

  // ---------------------------------------------------------------------------
  // Save
  // ---------------------------------------------------------------------------

  describe('save', () => {
    it('should save state to AsyncStorage', async () => {
      const state = createMockState('SAVE01');

      const result = await storage.save('SAVE01', state);

      expect(result).toBe(true);
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'werewolf_game_state_SAVE01',
        expect.any(String),
      );
    });

    it('should serialize Map fields correctly', async () => {
      const state = createMockState('SAVE02');

      await storage.save('SAVE02', state);

      const saved = await AsyncStorage.getItem('werewolf_game_state_SAVE02');
      const parsed = JSON.parse(saved!);

      // players should be array of [seat, player] tuples
      expect(Array.isArray(parsed.players)).toBe(true);
      expect(parsed.players.length).toBe(3);
      expect(parsed.players[0][0]).toBe(0); // seat number
      expect(parsed.players[0][1].uid).toBe('player_0');

      // actions should be array of [role, action] tuples
      expect(Array.isArray(parsed.actions)).toBe(true);
      expect(parsed.actions.length).toBe(2);

      // wolfVotes should be array of [seat, target] tuples
      expect(Array.isArray(parsed.wolfVotes)).toBe(true);
      expect(parsed.wolfVotes.length).toBe(1);
    });

    it('should include _savedAt timestamp', async () => {
      const before = Date.now();
      const state = createMockState('SAVE03');

      await storage.save('SAVE03', state);

      const saved = await AsyncStorage.getItem('werewolf_game_state_SAVE03');
      const parsed = JSON.parse(saved!);
      const after = Date.now();

      expect(parsed._savedAt).toBeGreaterThanOrEqual(before);
      expect(parsed._savedAt).toBeLessThanOrEqual(after);
    });
  });

  // ---------------------------------------------------------------------------
  // Load
  // ---------------------------------------------------------------------------

  describe('load', () => {
    it('should load and deserialize state', async () => {
      const state = createMockState('LOAD01');
      await storage.save('LOAD01', state);

      const loaded = await storage.load('LOAD01');

      expect(loaded).not.toBeNull();
      expect(loaded?.roomCode).toBe('LOAD01');
      expect(loaded?.hostUid).toBe('host_uid');
      expect(loaded?.status).toBe(GameStatus.ongoing);
    });

    it('should reconstruct Map fields', async () => {
      const state = createMockState('LOAD02');
      await storage.save('LOAD02', state);

      const loaded = await storage.load('LOAD02');

      expect(loaded?.players instanceof Map).toBe(true);
      expect(loaded?.players.size).toBe(3);
      expect(loaded?.players.get(0)?.uid).toBe('player_0');

      expect(loaded?.actions instanceof Map).toBe(true);
      expect(loaded?.actions.size).toBe(2);

      expect(loaded?.wolfVotes instanceof Map).toBe(true);
      expect(loaded?.wolfVotes.size).toBe(1);
      expect(loaded?.wolfVotes.get(0)).toBe(2);
    });

    it('should return null when no state exists', async () => {
      const loaded = await storage.load('NONEXISTENT');

      expect(loaded).toBeNull();
    });

    it('should return null when state is expired', async () => {
      // Create storage with very short expiry
      const shortExpiryStorage = Storage.createInstance({ expiryMs: 1 });

      const state = createMockState('EXPIRED01');
      await shortExpiryStorage.save('EXPIRED01', state);

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 10));

      const loaded = await shortExpiryStorage.load('EXPIRED01');

      expect(loaded).toBeNull();
    });

    it('should clear expired state from storage', async () => {
      const shortExpiryStorage = Storage.createInstance({ expiryMs: 1 });

      const state = createMockState('EXPIRED02');
      await shortExpiryStorage.save('EXPIRED02', state);

      await new Promise((resolve) => setTimeout(resolve, 10));

      await shortExpiryStorage.load('EXPIRED02');

      // State should be cleared after loading expired state
      const exists = await shortExpiryStorage.exists('EXPIRED02');
      expect(exists).toBe(false);
    });

    it('should load non-expired state', async () => {
      // Default expiry is 24 hours, so this should work
      const state = createMockState('FRESH01');
      await storage.save('FRESH01', state);

      const loaded = await storage.load('FRESH01');

      expect(loaded).not.toBeNull();
      expect(loaded?.roomCode).toBe('FRESH01');
    });
  });

  // ---------------------------------------------------------------------------
  // Clear
  // ---------------------------------------------------------------------------

  describe('clear', () => {
    it('should remove state from storage', async () => {
      const state = createMockState('CLEAR01');
      await storage.save('CLEAR01', state);

      await storage.clear('CLEAR01');

      const loaded = await storage.load('CLEAR01');
      expect(loaded).toBeNull();
    });

    it('should not throw when clearing non-existent state', async () => {
      await expect(storage.clear('NONEXISTENT')).resolves.not.toThrow();
    });
  });

  // ---------------------------------------------------------------------------
  // Exists
  // ---------------------------------------------------------------------------

  describe('exists', () => {
    it('should return true when state exists', async () => {
      const state = createMockState('EXISTS01');
      await storage.save('EXISTS01', state);

      const exists = await storage.exists('EXISTS01');

      expect(exists).toBe(true);
    });

    it('should return false when state does not exist', async () => {
      const exists = await storage.exists('NONEXISTENT');

      expect(exists).toBe(false);
    });

    it('should return true even for expired state', async () => {
      const shortExpiryStorage = Storage.createInstance({ expiryMs: 1 });

      const state = createMockState('EXPIRED03');
      await shortExpiryStorage.save('EXPIRED03', state);

      await new Promise((resolve) => setTimeout(resolve, 10));

      // exists() does NOT check expiry
      const exists = await shortExpiryStorage.exists('EXPIRED03');
      expect(exists).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // GetAge
  // ---------------------------------------------------------------------------

  describe('getAge', () => {
    it('should return age in milliseconds', async () => {
      const state = createMockState('AGE01');
      await storage.save('AGE01', state);

      // Wait a bit
      await new Promise((resolve) => setTimeout(resolve, 50));

      const age = await storage.getAge('AGE01');

      expect(age).not.toBeNull();
      expect(age).toBeGreaterThanOrEqual(50);
      expect(age).toBeLessThan(1000); // Shouldn't take more than 1 second
    });

    it('should return null when no state exists', async () => {
      const age = await storage.getAge('NONEXISTENT');

      expect(age).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Error Handling
  // ---------------------------------------------------------------------------

  describe('error handling', () => {
    it('should handle JSON parse errors gracefully', async () => {
      // Manually set invalid JSON
      await AsyncStorage.setItem('werewolf_game_state_INVALID', 'not valid json {{{');

      const loaded = await storage.load('INVALID');

      expect(loaded).toBeNull();
    });

    it('should return false when save fails', async () => {
      // Mock setItem to throw
      const mockSetItem = AsyncStorage.setItem as jest.Mock;
      mockSetItem.mockRejectedValueOnce(new Error('Storage full'));

      const state = createMockState('FAIL01');
      const result = await storage.save('FAIL01', state);

      expect(result).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Custom Config
  // ---------------------------------------------------------------------------

  describe('custom config', () => {
    it('should use custom key prefix', async () => {
      const customStorage = Storage.createInstance({ keyPrefix: 'custom_prefix_' });
      const state = createMockState('CUSTOM01');

      await customStorage.save('CUSTOM01', state);

      expect(AsyncStorage.setItem).toHaveBeenCalledWith('custom_prefix_CUSTOM01', expect.any(String));
    });

    it('should use custom expiry time', async () => {
      // 100ms expiry
      const customStorage = Storage.createInstance({ expiryMs: 100 });
      const state = createMockState('EXPIRY01');

      await customStorage.save('EXPIRY01', state);

      // Load immediately - should work
      const loaded1 = await customStorage.load('EXPIRY01');
      expect(loaded1).not.toBeNull();

      // Wait for expiry
      await new Promise((resolve) => setTimeout(resolve, 150));

      // Should be expired now
      const loaded2 = await customStorage.load('EXPIRY01');
      expect(loaded2).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Singleton
  // ---------------------------------------------------------------------------

  describe('singleton', () => {
    it('should return same instance', () => {
      const instance1 = Storage.getInstance();
      const instance2 = Storage.getInstance();

      expect(instance1).toBe(instance2);
    });

    it('should reset instance', () => {
      const instance1 = Storage.getInstance();
      Storage.resetInstance();
      const instance2 = Storage.getInstance();

      expect(instance1).not.toBe(instance2);
    });
  });
});
