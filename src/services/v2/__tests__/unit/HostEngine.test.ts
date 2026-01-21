/**
 * HostEngine Unit Tests
 *
 * 测试覆盖范围：
 * - Host 初始化
 * - 座位管理 (Host as Player)
 * - 角色分配
 * - 夜晚流程
 * - 消息处理
 */

import { HostEngine, HostEngineConfig } from '../../domain/HostEngine';
import { StateStore, GameStatus } from '../../infra/StateStore';
import type { Transport } from '../../infra/Transport';
import type { Storage } from '../../infra/Storage';
import type { Audio } from '../../infra/Audio';
import type { GameTemplate } from '../../../../models/Template';
import type { RoleId } from '../../../../models/roles';

// =============================================================================
// Test Fixtures
// =============================================================================

function createMockTemplate(roles: RoleId[] = ['wolf', 'seer', 'villager']): GameTemplate {
  return {
    numberOfPlayers: roles.length,
    roles,
    name: 'Test Template',
  };
}

function createMockTransport(): jest.Mocked<Transport> {
  return {
    joinRoom: jest.fn(() => Promise.resolve()),
    leaveRoom: jest.fn(() => Promise.resolve()),
    broadcastAsHost: jest.fn(() => Promise.resolve()),
    sendToHost: jest.fn(() => Promise.resolve(true)),
    setConnectionStatus: jest.fn(),
    getConnectionStatus: jest.fn(() => 'live'),
    reset: jest.fn(),
  } as unknown as jest.Mocked<Transport>;
}

function createMockStorage(): jest.Mocked<Storage> {
  return {
    save: jest.fn(() => Promise.resolve()),
    load: jest.fn(() => Promise.resolve(null)),
    remove: jest.fn(() => Promise.resolve()),
  } as unknown as jest.Mocked<Storage>;
}

function createMockAudio(): jest.Mocked<Audio> {
  return {
    playNightBegin: jest.fn(() => Promise.resolve()),
    playNightEnd: jest.fn(() => Promise.resolve()),
    playRoleBegin: jest.fn(() => Promise.resolve()),
    playRoleEnd: jest.fn(() => Promise.resolve()),
    stop: jest.fn(() => Promise.resolve()),
    setEnabled: jest.fn(),
    isEnabled: jest.fn(() => true),
  } as unknown as jest.Mocked<Audio>;
}

function createHostEngine(overrides: Partial<HostEngineConfig> = {}): {
  engine: HostEngine;
  stateStore: StateStore;
  transport: jest.Mocked<Transport>;
  storage: jest.Mocked<Storage>;
  audio: jest.Mocked<Audio>;
  notifyListeners: jest.Mock;
} {
  const stateStore = new StateStore();
  const transport = createMockTransport();
  const storage = createMockStorage();
  const audio = createMockAudio();
  const notifyListeners = jest.fn();

  const engine = new HostEngine({
    stateStore,
    transport,
    storage,
    audio,
    onNotifyListeners: notifyListeners,
    ...overrides,
  });

  return { engine, stateStore, transport, storage, audio, notifyListeners };
}

async function initializeHostEngine(
  fixture: ReturnType<typeof createHostEngine>,
  template: GameTemplate = createMockTemplate(),
) {
  await fixture.engine.initialize('ABCD', 'host-uid', template);
}

async function setupSeatedGame(fixture: ReturnType<typeof createHostEngine>) {
  await initializeHostEngine(fixture);
  // Seat all players
  await fixture.engine.getPlayerActions().takeSeat(0, 'host-uid', 'Host');
  await fixture.engine.handlePlayerMessage(
    { type: 'JOIN', seat: 1, uid: 'player1-uid', displayName: 'Player1' },
    'player1-uid',
  );
  await fixture.engine.handlePlayerMessage(
    { type: 'JOIN', seat: 2, uid: 'player2-uid', displayName: 'Player2' },
    'player2-uid',
  );
}

async function setupAssignedGame(fixture: ReturnType<typeof createHostEngine>) {
  await setupSeatedGame(fixture);
  await fixture.engine.assignRoles();
}

async function setupOngoingGame(fixture: ReturnType<typeof createHostEngine>) {
  await setupAssignedGame(fixture);
  // Simulate all viewed
  fixture.stateStore.update(() => ({ status: GameStatus.ready }));
}

// =============================================================================
// Tests
// =============================================================================

describe('HostEngine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Initialization
  // ---------------------------------------------------------------------------

  describe('initialize', () => {
    it('should initialize state with unseated status', async () => {
      const fixture = createHostEngine();
      await initializeHostEngine(fixture);

      const state = fixture.stateStore.getState();
      expect(state).not.toBeNull();
      expect(state?.status).toBe(GameStatus.unseated);
      expect(state?.roomCode).toBe('ABCD');
      expect(state?.hostUid).toBe('host-uid');
    });

    it('should create empty player slots based on template', async () => {
      const fixture = createHostEngine();
      const template = createMockTemplate(['wolf', 'seer', 'villager', 'hunter']);
      await initializeHostEngine(fixture, template);

      const state = fixture.stateStore.getState();
      expect(state?.players.size).toBe(4);
      // All seats should be null (empty)
      for (let i = 0; i < 4; i++) {
        expect(state?.players.get(i)).toBeNull();
      }
    });

    it('should join transport room', async () => {
      const fixture = createHostEngine();
      await initializeHostEngine(fixture);

      expect(fixture.transport.joinRoom).toHaveBeenCalledWith(
        'ABCD',
        'host-uid',
        expect.any(Object),
      );
    });

    it('should broadcast initial state', async () => {
      const fixture = createHostEngine();
      await initializeHostEngine(fixture);

      expect(fixture.transport.broadcastAsHost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'STATE_UPDATE',
        }),
      );
    });

    it('should notify listeners', async () => {
      const fixture = createHostEngine();
      await initializeHostEngine(fixture);

      expect(fixture.notifyListeners).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // Host as Player (via PlayerActions interface)
  // ---------------------------------------------------------------------------

  describe('getPlayerActions', () => {
    it('should return LocalPlayerAdapter', async () => {
      const fixture = createHostEngine();
      await initializeHostEngine(fixture);

      const actions = fixture.engine.getPlayerActions();
      expect(actions).toBeDefined();
      expect(typeof actions.takeSeat).toBe('function');
      expect(typeof actions.leaveSeat).toBe('function');
      expect(typeof actions.submitAction).toBe('function');
      expect(typeof actions.submitWolfVote).toBe('function');
    });
  });

  describe('handleLocalTakeSeat (Host as Player)', () => {
    it('should allow host to take empty seat', async () => {
      const fixture = createHostEngine();
      await initializeHostEngine(fixture);

      const result = await fixture.engine.getPlayerActions().takeSeat(0, 'host-uid', 'Host', 'avatar.jpg');

      expect(result).toBe(true);
      const state = fixture.stateStore.getState();
      const player = state?.players.get(0);
      expect(player).not.toBeNull();
      expect(player?.uid).toBe('host-uid');
      expect(player?.displayName).toBe('Host');
    });

    it('should reject if seat is already taken', async () => {
      const fixture = createHostEngine();
      await initializeHostEngine(fixture);

      // First player takes seat 0
      await fixture.engine.getPlayerActions().takeSeat(0, 'host-uid', 'Host');

      // Another player tries to take same seat
      const result = await fixture.engine.getPlayerActions().takeSeat(0, 'other-uid', 'Other');

      expect(result).toBe(false);
    });

    it('should broadcast state after taking seat', async () => {
      const fixture = createHostEngine();
      await initializeHostEngine(fixture);
      fixture.transport.broadcastAsHost.mockClear();

      await fixture.engine.getPlayerActions().takeSeat(0, 'host-uid', 'Host');

      expect(fixture.transport.broadcastAsHost).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'STATE_UPDATE' }),
      );
    });
  });

  describe('handleLocalLeaveSeat (Host as Player)', () => {
    it('should allow host to leave their seat', async () => {
      const fixture = createHostEngine();
      await initializeHostEngine(fixture);

      // Take seat first
      await fixture.engine.getPlayerActions().takeSeat(0, 'host-uid', 'Host');

      // Leave seat
      const result = await fixture.engine.getPlayerActions().leaveSeat(0, 'host-uid');

      expect(result).toBe(true);
      const state = fixture.stateStore.getState();
      expect(state?.players.get(0)).toBeNull();
    });

    it('should reject if trying to leave seat occupied by another player', async () => {
      const fixture = createHostEngine();
      await initializeHostEngine(fixture);

      // Player takes seat
      await fixture.engine.handlePlayerMessage(
        { type: 'JOIN', seat: 0, uid: 'other-uid', displayName: 'Other' },
        'other-uid',
      );

      // Host tries to leave that seat
      const result = await fixture.engine.getPlayerActions().leaveSeat(0, 'host-uid');

      expect(result).toBe(false);
    });
  });

  // ---------------------------------------------------------------------------
  // Remote Player Message Handling
  // ---------------------------------------------------------------------------

  describe('handlePlayerMessage - JOIN', () => {
    it('should seat player when seat is empty', async () => {
      const fixture = createHostEngine();
      await initializeHostEngine(fixture);

      await fixture.engine.handlePlayerMessage(
        { type: 'JOIN', seat: 1, uid: 'player-uid', displayName: 'Player1', avatarUrl: 'avatar.jpg' },
        'player-uid',
      );

      const state = fixture.stateStore.getState();
      const player = state?.players.get(1);
      expect(player).not.toBeNull();
      expect(player?.uid).toBe('player-uid');
      expect(player?.displayName).toBe('Player1');
    });

    it('should broadcast SEAT_REJECTED when seat is taken', async () => {
      const fixture = createHostEngine();
      await initializeHostEngine(fixture);

      // First player takes seat
      await fixture.engine.handlePlayerMessage(
        { type: 'JOIN', seat: 1, uid: 'player1-uid', displayName: 'Player1' },
        'player1-uid',
      );
      fixture.transport.broadcastAsHost.mockClear();

      // Second player tries same seat
      await fixture.engine.handlePlayerMessage(
        { type: 'JOIN', seat: 1, uid: 'player2-uid', displayName: 'Player2' },
        'player2-uid',
      );

      expect(fixture.transport.broadcastAsHost).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'SEAT_REJECTED',
          seat: 1,
          requestUid: 'player2-uid',
          reason: 'seat_taken',
        }),
      );
    });
  });

  describe('handlePlayerMessage - LEAVE', () => {
    it('should remove player from seat', async () => {
      const fixture = createHostEngine();
      await initializeHostEngine(fixture);

      // Player joins
      await fixture.engine.handlePlayerMessage(
        { type: 'JOIN', seat: 1, uid: 'player-uid', displayName: 'Player1' },
        'player-uid',
      );

      // Player leaves
      await fixture.engine.handlePlayerMessage(
        { type: 'LEAVE', seat: 1, uid: 'player-uid' },
        'player-uid',
      );

      const state = fixture.stateStore.getState();
      expect(state?.players.get(1)).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Role Assignment
  // ---------------------------------------------------------------------------

  describe('assignRoles', () => {
    it('should assign roles when all players are seated', async () => {
      const fixture = createHostEngine();
      await setupSeatedGame(fixture);

      await fixture.engine.assignRoles();

      const state = fixture.stateStore.getState();
      expect(state?.status).toBe(GameStatus.assigned);

      // All players should have roles
      const roles: (RoleId | null)[] = [];
      for (const [_seat, player] of state?.players ?? []) {
        if (player) {
          roles.push(player.role);
        }
      }
      expect(roles).toHaveLength(3);
      expect(roles.every((r) => r !== null)).toBe(true);
    });

    it('should not assign roles if game not in seated status', async () => {
      const fixture = createHostEngine();
      await initializeHostEngine(fixture);
      // Only one player seated

      await fixture.engine.assignRoles();

      const state = fixture.stateStore.getState();
      expect(state?.status).toBe(GameStatus.unseated);
    });

    it('should set hasViewedRole to false for all players', async () => {
      const fixture = createHostEngine();
      await setupSeatedGame(fixture);

      await fixture.engine.assignRoles();

      const state = fixture.stateStore.getState();
      for (const [_seat, player] of state?.players ?? []) {
        if (player) {
          expect(player.hasViewedRole).toBe(false);
        }
      }
    });
  });

  // ---------------------------------------------------------------------------
  // viewedRole handling
  // ---------------------------------------------------------------------------

  describe('handleLocalViewedRole', () => {
    it('should mark player as having viewed their role', async () => {
      const fixture = createHostEngine();
      await setupAssignedGame(fixture);

      await fixture.engine.getPlayerActions().viewedRole(0);

      const state = fixture.stateStore.getState();
      expect(state?.players.get(0)?.hasViewedRole).toBe(true);
    });

    it('should transition to ready when all players have viewed', async () => {
      const fixture = createHostEngine();
      await setupAssignedGame(fixture);

      // All players view their roles
      await fixture.engine.getPlayerActions().viewedRole(0);
      await fixture.engine.handlePlayerMessage({ type: 'VIEWED_ROLE', seat: 1 }, 'player1-uid');
      await fixture.engine.handlePlayerMessage({ type: 'VIEWED_ROLE', seat: 2 }, 'player2-uid');

      const state = fixture.stateStore.getState();
      expect(state?.status).toBe(GameStatus.ready);
    });
  });

  // ---------------------------------------------------------------------------
  // Template Update
  // ---------------------------------------------------------------------------

  describe('updateTemplate', () => {
    it('should update template before game starts', async () => {
      const fixture = createHostEngine();
      await initializeHostEngine(fixture);

      const newTemplate = createMockTemplate(['wolf', 'wolf', 'seer', 'hunter', 'villager']);
      await fixture.engine.updateTemplate(newTemplate);

      const state = fixture.stateStore.getState();
      expect(state?.template.numberOfPlayers).toBe(5);
      expect(state?.players.size).toBe(5);
    });

    it('should not update template after roles assigned', async () => {
      const fixture = createHostEngine();
      await initializeHostEngine(fixture);

      // Force to assigned status
      fixture.stateStore.update(() => ({ status: GameStatus.assigned }));

      const oldTemplate = fixture.stateStore.getState()?.template;
      await fixture.engine.updateTemplate(createMockTemplate(['wolf', 'wolf', 'seer', 'hunter', 'villager']));

      expect(fixture.stateStore.getState()?.template).toBe(oldTemplate);
    });
  });

  // ---------------------------------------------------------------------------
  // Restart Game
  // ---------------------------------------------------------------------------

  describe('restartGame', () => {
    it('should reset to seated status', async () => {
      const fixture = createHostEngine();
      await setupOngoingGame(fixture);

      await fixture.engine.restartGame();

      const state = fixture.stateStore.getState();
      expect(state?.status).toBe(GameStatus.seated);
    });

    it('should clear player roles', async () => {
      const fixture = createHostEngine();
      await setupOngoingGame(fixture);

      await fixture.engine.restartGame();

      const state = fixture.stateStore.getState();
      for (const [_seat, player] of state?.players ?? []) {
        if (player) {
          expect(player.role).toBeNull();
        }
      }
    });

    it('should broadcast GAME_RESTARTED message', async () => {
      const fixture = createHostEngine();
      await setupOngoingGame(fixture);
      fixture.transport.broadcastAsHost.mockClear();

      await fixture.engine.restartGame();

      expect(fixture.transport.broadcastAsHost).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'GAME_RESTARTED' }),
      );
    });
  });

  // ---------------------------------------------------------------------------
  // State Revision
  // ---------------------------------------------------------------------------

  describe('getRevision', () => {
    it('should increment after each broadcast', async () => {
      const fixture = createHostEngine();
      await initializeHostEngine(fixture);

      const rev1 = fixture.engine.getRevision();

      await fixture.engine.getPlayerActions().takeSeat(0, 'host-uid', 'Host');
      const rev2 = fixture.engine.getRevision();

      expect(rev2).toBeGreaterThan(rev1);
    });
  });

  // ---------------------------------------------------------------------------
  // Reset
  // ---------------------------------------------------------------------------

  describe('reset', () => {
    it('should clear callbacks and reset revision', async () => {
      const fixture = createHostEngine();
      await initializeHostEngine(fixture);

      fixture.engine.setCallbacks({ onNightEnd: jest.fn() });
      fixture.engine.reset();

      // After reset, revision should be 0
      expect(fixture.engine.getRevision()).toBe(0);
    });
  });
});
