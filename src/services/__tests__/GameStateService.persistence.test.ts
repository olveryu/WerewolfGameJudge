/**
 * GameStateService Persistence Tests
 *
 * Tests for Host state persistence and recovery via AsyncStorage:
 * 1. saveStateToStorage - saves state on broadcast
 * 2. loadStateFromStorage - loads state on rejoin
 * 3. clearSavedState - clears state on leave
 * 4. State expiry handling
 * 5. rejoinAsHost recovery flow
 */

import { GameStateService } from '../GameStateService';
import { GameStatus } from '../types/GameStateTypes';
import { GameTemplate } from '../../models/Template';
import type { RoleId } from '../../models/roles';
import AsyncStorage from '@react-native-async-storage/async-storage';

// =============================================================================
// Mocks
// =============================================================================

const mockBroadcastAsHost = jest.fn().mockResolvedValue(undefined);
const mockJoinRoom = jest.fn().mockResolvedValue(undefined);
const mockLeaveRoom = jest.fn().mockResolvedValue(undefined);

jest.mock('../BroadcastService', () => ({
  BroadcastService: {
    getInstance: jest.fn(() => ({
      joinRoom: mockJoinRoom,
      leaveRoom: mockLeaveRoom,
      broadcastAsHost: mockBroadcastAsHost,
      broadcastPublic: jest.fn().mockResolvedValue(undefined),
      sendPrivate: jest.fn().mockResolvedValue(undefined),
      sendToHost: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

jest.mock('../AudioService', () => ({
  __esModule: true,
  default: {
    getInstance: jest.fn(() => ({
      stop: jest.fn(),
      playNightBeginAudio: jest.fn().mockResolvedValue(undefined),
      playNightEndAudio: jest.fn().mockResolvedValue(undefined),
      playRoleBeginningAudio: jest.fn().mockResolvedValue(undefined),
      playRoleEndingAudio: jest.fn().mockResolvedValue(undefined),
    })),
  },
}));

// =============================================================================
// Test Helpers
// =============================================================================

const STORAGE_KEY_PREFIX = 'werewolf_game_state_';

function createTestTemplate(): GameTemplate {
  return {
    name: 'Test Template',
    roles: ['wolf', 'wolf', 'villager', 'villager', 'seer', 'witch'] as RoleId[],
    numberOfPlayers: 6,
  };
}

function resetGameStateService(): GameStateService {
  (GameStateService as any).instance = undefined;
  return GameStateService.getInstance();
}

function getState(service: GameStateService) {
  return service.getState();
}

async function initializeHostWithPlayers(
  service: GameStateService,
  roomCode: string = 'room1234',
): Promise<void> {
  const template = createTestTemplate();
  await service.initializeAsHost(roomCode, 'host_uid', template);

  const state = getState(service)!;
  for (let i = 0; i < template.numberOfPlayers; i++) {
    state.players.set(i, {
      uid: `player_${i}`,
      seatNumber: i,
      displayName: `Player ${i + 1}`,
      avatarUrl: undefined,
      role: null,
      hasViewedRole: false,
    });
  }
  state.status = GameStatus.seated;

  // Manually trigger save since we modified state directly
  await (service as any).saveStateToStorage();
}

// =============================================================================
// Tests
// =============================================================================

describe('GameStateService Persistence', () => {
  let service: GameStateService;

  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    service = resetGameStateService();
  });

  describe('State Saving', () => {
    it('saves state to AsyncStorage after broadcast', async () => {
      await initializeHostWithPlayers(service, 'TEST01');

      // Wait for async save to complete
      await new Promise((resolve) => setTimeout(resolve, 50));

      const key = `${STORAGE_KEY_PREFIX}TEST01`;
      const saved = await AsyncStorage.getItem(key);

      expect(saved).not.toBeNull();
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(key, expect.any(String));
    });

    it('saved state contains all required fields', async () => {
      await initializeHostWithPlayers(service, 'TEST02');
      await new Promise((resolve) => setTimeout(resolve, 50));

      const key = `${STORAGE_KEY_PREFIX}TEST02`;
      const saved = await AsyncStorage.getItem(key);
      const parsed = JSON.parse(saved!);

      expect(parsed.roomCode).toBe('TEST02');
      expect(parsed.hostUid).toBe('host_uid');
      expect(parsed.status).toBe(GameStatus.seated);
      expect(parsed._savedAt).toBeDefined();
      expect(Array.isArray(parsed.players)).toBe(true);
      expect(Array.isArray(parsed.actions)).toBe(true);
      expect(Array.isArray(parsed.wolfVotes)).toBe(true);
    });

    it('serializes Map fields correctly', async () => {
      await initializeHostWithPlayers(service, 'TEST03');
      await new Promise((resolve) => setTimeout(resolve, 50));

      const key = `${STORAGE_KEY_PREFIX}TEST03`;
      const saved = await AsyncStorage.getItem(key);
      const parsed = JSON.parse(saved!);

      // players should be serialized as array of [key, value] pairs
      expect(parsed.players.length).toBe(6);
      expect(parsed.players[0]).toEqual([
        0,
        expect.objectContaining({ uid: 'player_0', seatNumber: 0 }),
      ]);
    });
  });

  describe('State Loading', () => {
    it('loads state from AsyncStorage on rejoinAsHost', async () => {
      // First, create and save state
      await initializeHostWithPlayers(service, 'TEST04');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Reset service to simulate app restart
      service = resetGameStateService();

      // Rejoin as host
      await service.rejoinAsHost('TEST04', 'host_uid');

      const state = getState(service);
      expect(state).not.toBeNull();
      expect(state!.roomCode).toBe('TEST04');
      expect(state!.status).toBe(GameStatus.seated);
      expect(state!.players.size).toBe(6);
    });

    it('deserializes Map fields correctly', async () => {
      await initializeHostWithPlayers(service, 'TEST05');
      await new Promise((resolve) => setTimeout(resolve, 50));

      service = resetGameStateService();
      await service.rejoinAsHost('TEST05', 'host_uid');

      const state = getState(service);
      expect(state!.players).toBeInstanceOf(Map);
      expect(state!.actions).toBeInstanceOf(Map);
      expect(state!.wolfVotes).toBeInstanceOf(Map);

      const player0 = state!.players.get(0);
      expect(player0).toEqual(
        expect.objectContaining({
          uid: 'player_0',
          seatNumber: 0,
        }),
      );
    });

    it('restores mySeatNumber if host was seated', async () => {
      await initializeHostWithPlayers(service, 'TEST06');

      // Simulate host sitting at seat 0
      const state = getState(service)!;
      state.players.set(0, {
        uid: 'host_uid',
        seatNumber: 0,
        displayName: 'Host',
        avatarUrl: undefined,
        role: null,
        hasViewedRole: false,
      });

      // Force save
      await (service as any).saveStateToStorage();
      await new Promise((resolve) => setTimeout(resolve, 50));

      service = resetGameStateService();
      await service.rejoinAsHost('TEST06', 'host_uid');

      expect(service.getMySeatNumber()).toBe(0);
    });

    it('creates placeholder state if no saved state exists', async () => {
      await service.rejoinAsHost('NOEXIST', 'host_uid');

      const state = getState(service);
      expect(state).not.toBeNull();
      expect(state!.roomCode).toBe('NOEXIST');
      expect(state!.status).toBe(GameStatus.unseated);
      expect(state!.template.numberOfPlayers).toBe(0);
      expect(state!.players.size).toBe(0);
    });
  });

  describe('State Expiry', () => {
    it('discards expired state (older than 24 hours)', async () => {
      // Create and save state with old timestamp
      await initializeHostWithPlayers(service, 'EXPIRED');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Modify saved state to have old timestamp
      const key = `${STORAGE_KEY_PREFIX}EXPIRED`;
      const saved = await AsyncStorage.getItem(key);
      const parsed = JSON.parse(saved!);
      parsed._savedAt = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago
      await AsyncStorage.setItem(key, JSON.stringify(parsed));

      service = resetGameStateService();
      await service.rejoinAsHost('EXPIRED', 'host_uid');

      // Should create placeholder, not restore old state
      const state = getState(service);
      expect(state!.status).toBe(GameStatus.unseated);
      expect(state!.template.numberOfPlayers).toBe(0);
    });

    it('loads non-expired state (less than 24 hours old)', async () => {
      await initializeHostWithPlayers(service, 'RECENT');
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Modify saved state to have recent timestamp (1 hour ago)
      const key = `${STORAGE_KEY_PREFIX}RECENT`;
      const saved = await AsyncStorage.getItem(key);
      const parsed = JSON.parse(saved!);
      parsed._savedAt = Date.now() - 1 * 60 * 60 * 1000; // 1 hour ago
      await AsyncStorage.setItem(key, JSON.stringify(parsed));

      service = resetGameStateService();
      await service.rejoinAsHost('RECENT', 'host_uid');

      const state = getState(service);
      expect(state!.status).toBe(GameStatus.seated);
      expect(state!.players.size).toBe(6);
    });
  });

  describe('State Clearing', () => {
    it('clears saved state when host leaves room', async () => {
      await initializeHostWithPlayers(service, 'LEAVE01');
      await new Promise((resolve) => setTimeout(resolve, 50));

      const key = `${STORAGE_KEY_PREFIX}LEAVE01`;
      expect(await AsyncStorage.getItem(key)).not.toBeNull();

      await service.leaveRoom();

      expect(await AsyncStorage.getItem(key)).toBeNull();
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(key);
    });

    it('clearSavedState removes state for specific room', async () => {
      await initializeHostWithPlayers(service, 'CLEAR01');
      await new Promise((resolve) => setTimeout(resolve, 50));

      const key = `${STORAGE_KEY_PREFIX}CLEAR01`;
      expect(await AsyncStorage.getItem(key)).not.toBeNull();

      await service.clearSavedState('CLEAR01');

      expect(await AsyncStorage.getItem(key)).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('handles JSON parse errors gracefully', async () => {
      const key = `${STORAGE_KEY_PREFIX}INVALID`;
      await AsyncStorage.setItem(key, 'not valid json {{{');

      // Should not throw, should create placeholder
      await expect(service.rejoinAsHost('INVALID', 'host_uid')).resolves.not.toThrow();

      const state = getState(service);
      expect(state!.status).toBe(GameStatus.unseated);
    });

    it('continues working if save fails', async () => {
      // Mock setItem to fail
      const originalSetItem = AsyncStorage.setItem;
      (AsyncStorage.setItem as jest.Mock).mockRejectedValueOnce(new Error('Storage full'));

      await initializeHostWithPlayers(service, 'SAVEFAIL');

      // Should not throw, game should continue
      const state = getState(service);
      expect(state).not.toBeNull();
      expect(state!.roomCode).toBe('SAVEFAIL');

      // Restore
      AsyncStorage.setItem = originalSetItem;
    });
  });
});
