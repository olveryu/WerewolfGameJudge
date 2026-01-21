/**
 * StatePersistence Unit Tests
 *
 * Phase 2 of GameStateService refactoring.
 * Tests cover:
 * - Save/load/clear state
 * - Serialization of Maps
 * - Expiry logic
 * - Error handling
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

import type { LocalGameState } from '../../../v2/types/GameState';
import { GameStatus } from '../../../v2/types/GameState';
import { StatePersistence } from '../StatePersistence';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

const mockAsyncStorage = AsyncStorage as jest.Mocked<typeof AsyncStorage>;

// ===========================================================================
// Test Fixtures
// ===========================================================================

function createMockState(overrides: Partial<LocalGameState> = {}): LocalGameState {
  return {
    roomCode: 'ABCD',
    hostUid: 'host-123',
    status: GameStatus.unseated,
    template: {
      roles: ['villager', 'wolf', 'seer'],
      wolfCount: 1,
      villagerCount: 1,
      godCount: 1,
    },
    players: new Map([
      [
        1,
        {
          uid: 'player1',
          displayName: 'Player 1',
          seatNumber: 1,
          role: 'villager',
          hasViewedRole: false,
        },
      ],
      [
        2,
        {
          uid: 'player2',
          displayName: 'Player 2',
          seatNumber: 2,
          role: 'wolf',
          hasViewedRole: true,
        },
      ],
    ]),
    actions: new Map([['seer', { kind: 'singleTarget', targetSeat: 2 }]]),
    wolfVotes: new Map([[2, 1]]),
    currentActionerIndex: 0,
    isAudioPlaying: false,
    lastNightDeaths: [],
    currentNightResults: {},
    ...overrides,
  } as LocalGameState;
}

// ===========================================================================
// Test Suite
// ===========================================================================

describe('StatePersistence', () => {
  let persistence: StatePersistence;

  beforeEach(() => {
    jest.clearAllMocks();
    persistence = new StatePersistence();
  });

  // =========================================================================
  // saveState
  // =========================================================================

  describe('saveState', () => {
    it('should save state to AsyncStorage with correct key', async () => {
      const state = createMockState({ roomCode: 'TEST' });
      mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

      const result = await persistence.saveState('TEST', state);

      expect(result).toBe(true);
      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'werewolf_game_state_TEST',
        expect.any(String),
      );
    });

    it('should serialize Maps correctly', async () => {
      const state = createMockState();
      mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

      await persistence.saveState('ABCD', state);

      const savedJson = mockAsyncStorage.setItem.mock.calls[0][1];
      const parsed = JSON.parse(savedJson);

      // Maps should be serialized as arrays
      expect(Array.isArray(parsed.players)).toBe(true);
      expect(Array.isArray(parsed.actions)).toBe(true);
      expect(Array.isArray(parsed.wolfVotes)).toBe(true);

      // Check content
      expect(parsed.players).toHaveLength(2);
      expect(parsed.players[0][0]).toBe(1); // seat number
      expect(parsed.players[0][1].uid).toBe('player1');
    });

    it('should include _savedAt timestamp', async () => {
      const state = createMockState();
      const beforeSave = Date.now();
      mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

      await persistence.saveState('ABCD', state);

      const savedJson = mockAsyncStorage.setItem.mock.calls[0][1];
      const parsed = JSON.parse(savedJson);
      const afterSave = Date.now();

      expect(parsed._savedAt).toBeGreaterThanOrEqual(beforeSave);
      expect(parsed._savedAt).toBeLessThanOrEqual(afterSave);
    });

    it('should return false on save error', async () => {
      const state = createMockState();
      mockAsyncStorage.setItem.mockRejectedValueOnce(new Error('Storage full'));

      const result = await persistence.saveState('ABCD', state);

      expect(result).toBe(false);
    });

    it('should use custom key prefix if configured', async () => {
      persistence = new StatePersistence({ keyPrefix: 'custom_prefix_' });
      const state = createMockState();
      mockAsyncStorage.setItem.mockResolvedValueOnce(undefined);

      await persistence.saveState('ROOM', state);

      expect(mockAsyncStorage.setItem).toHaveBeenCalledWith(
        'custom_prefix_ROOM',
        expect.any(String),
      );
    });
  });

  // =========================================================================
  // loadState
  // =========================================================================

  describe('loadState', () => {
    it('should load and deserialize state correctly', async () => {
      const originalState = createMockState();
      const serialized = JSON.stringify({
        ...originalState,
        players: Array.from(originalState.players.entries()),
        actions: Array.from(originalState.actions.entries()),
        wolfVotes: Array.from(originalState.wolfVotes.entries()),
        _savedAt: Date.now(),
      });
      mockAsyncStorage.getItem.mockResolvedValueOnce(serialized);

      const loadedState = await persistence.loadState('ABCD');

      expect(loadedState).not.toBeNull();
      expect(loadedState!.roomCode).toBe('ABCD');
      expect(loadedState!.players instanceof Map).toBe(true);
      expect(loadedState!.actions instanceof Map).toBe(true);
      expect(loadedState!.wolfVotes instanceof Map).toBe(true);
      expect(loadedState!.players.get(1)?.uid).toBe('player1');
    });

    it('should return null if no state found', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(null);

      const result = await persistence.loadState('NONEXISTENT');

      expect(result).toBeNull();
    });

    it('should return null and clear if state is expired', async () => {
      const expiredTime = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
      const originalState = createMockState();
      const serialized = JSON.stringify({
        ...originalState,
        players: Array.from(originalState.players.entries()),
        actions: Array.from(originalState.actions.entries()),
        wolfVotes: Array.from(originalState.wolfVotes.entries()),
        _savedAt: expiredTime,
      });
      mockAsyncStorage.getItem.mockResolvedValueOnce(serialized);
      mockAsyncStorage.removeItem.mockResolvedValueOnce(undefined);

      const result = await persistence.loadState('ABCD');

      expect(result).toBeNull();
      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('werewolf_game_state_ABCD');
    });

    it('should return state if within expiry time', async () => {
      const recentTime = Date.now() - 1 * 60 * 60 * 1000; // 1 hour ago
      const originalState = createMockState();
      const serialized = JSON.stringify({
        ...originalState,
        players: Array.from(originalState.players.entries()),
        actions: Array.from(originalState.actions.entries()),
        wolfVotes: Array.from(originalState.wolfVotes.entries()),
        _savedAt: recentTime,
      });
      mockAsyncStorage.getItem.mockResolvedValueOnce(serialized);

      const result = await persistence.loadState('ABCD');

      expect(result).not.toBeNull();
      expect(result!.roomCode).toBe('ABCD');
    });

    it('should return null on corrupted JSON', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce('not valid json{{{');

      const result = await persistence.loadState('ABCD');

      expect(result).toBeNull();
    });

    it('should return null on AsyncStorage error', async () => {
      mockAsyncStorage.getItem.mockRejectedValueOnce(new Error('Permission denied'));

      const result = await persistence.loadState('ABCD');

      expect(result).toBeNull();
    });

    it('should use custom expiry time if configured', async () => {
      // 1 minute expiry
      persistence = new StatePersistence({ expiryMs: 60 * 1000 });

      // 2 minutes ago - should be expired
      const twoMinutesAgo = Date.now() - 2 * 60 * 1000;
      const originalState = createMockState();
      const serialized = JSON.stringify({
        ...originalState,
        players: Array.from(originalState.players.entries()),
        actions: Array.from(originalState.actions.entries()),
        wolfVotes: Array.from(originalState.wolfVotes.entries()),
        _savedAt: twoMinutesAgo,
      });
      mockAsyncStorage.getItem.mockResolvedValueOnce(serialized);
      mockAsyncStorage.removeItem.mockResolvedValueOnce(undefined);

      const result = await persistence.loadState('ABCD');

      expect(result).toBeNull();
    });
  });

  // =========================================================================
  // clearState
  // =========================================================================

  describe('clearState', () => {
    it('should remove state from AsyncStorage', async () => {
      mockAsyncStorage.removeItem.mockResolvedValueOnce(undefined);

      await persistence.clearState('ABCD');

      expect(mockAsyncStorage.removeItem).toHaveBeenCalledWith('werewolf_game_state_ABCD');
    });

    it('should not throw on error', async () => {
      mockAsyncStorage.removeItem.mockRejectedValueOnce(new Error('Error'));

      // Should not throw
      await expect(persistence.clearState('ABCD')).resolves.toBeUndefined();
    });
  });

  // =========================================================================
  // hasState
  // =========================================================================

  describe('hasState', () => {
    it('should return true if state exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce('{"some": "data"}');

      const result = await persistence.hasState('ABCD');

      expect(result).toBe(true);
    });

    it('should return false if no state exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(null);

      const result = await persistence.hasState('ABCD');

      expect(result).toBe(false);
    });

    it('should return false on error', async () => {
      mockAsyncStorage.getItem.mockRejectedValueOnce(new Error('Error'));

      const result = await persistence.hasState('ABCD');

      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // getStateAge
  // =========================================================================

  describe('getStateAge', () => {
    it('should return age in milliseconds', async () => {
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
      const originalState = createMockState();
      const serialized = JSON.stringify({
        ...originalState,
        players: Array.from(originalState.players.entries()),
        actions: Array.from(originalState.actions.entries()),
        wolfVotes: Array.from(originalState.wolfVotes.entries()),
        _savedAt: fiveMinutesAgo,
      });
      mockAsyncStorage.getItem.mockResolvedValueOnce(serialized);

      const age = await persistence.getStateAge('ABCD');

      expect(age).not.toBeNull();
      // Age should be approximately 5 minutes (allow 1 second tolerance)
      expect(age!).toBeGreaterThanOrEqual(5 * 60 * 1000 - 1000);
      expect(age!).toBeLessThanOrEqual(5 * 60 * 1000 + 1000);
    });

    it('should return null if no state exists', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce(null);

      const age = await persistence.getStateAge('ABCD');

      expect(age).toBeNull();
    });

    it('should return null on corrupted data', async () => {
      mockAsyncStorage.getItem.mockResolvedValueOnce('invalid json');

      const age = await persistence.getStateAge('ABCD');

      expect(age).toBeNull();
    });
  });

  // =========================================================================
  // Round-trip test
  // =========================================================================

  describe('round-trip', () => {
    it('should preserve all data through save and load', async () => {
      const originalState = createMockState({
        roomCode: 'ROUND',
        status: GameStatus.ongoing,
        currentNightResults: {
          wolfKillTarget: 3,
          wolfKillDisabled: true,
        },
      });

      // Set up mock to capture saved data and return it on load
      let savedData: string | null = null;
      mockAsyncStorage.setItem.mockImplementation(async (_key, value) => {
        savedData = value;
      });
      mockAsyncStorage.getItem.mockImplementation(async () => savedData);

      // Save
      await persistence.saveState('ROUND', originalState);

      // Load
      const loadedState = await persistence.loadState('ROUND');

      // Verify
      expect(loadedState).not.toBeNull();
      expect(loadedState!.roomCode).toBe(originalState.roomCode);
      expect(loadedState!.status).toBe(originalState.status);
      expect(loadedState!.currentNightResults).toEqual(originalState.currentNightResults);

      // Verify Maps
      expect(loadedState!.players.size).toBe(originalState.players.size);
      expect(loadedState!.actions.size).toBe(originalState.actions.size);
      expect(loadedState!.wolfVotes.size).toBe(originalState.wolfVotes.size);

      // Verify Map contents
      for (const [seat, player] of originalState.players) {
        expect(loadedState!.players.get(seat)).toEqual(player);
      }
    });
  });
});
