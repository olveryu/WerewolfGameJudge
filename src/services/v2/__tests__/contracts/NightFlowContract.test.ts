/**
 * HostEngine Night Flow Contract Tests
 *
 * 测试夜晚流程的完整合约：
 * - startGame 广播正确消息
 * - 行动提交记录到 state.actions
 * - 错误角色行动被拒绝
 * - 夜晚结束时计算死亡
 */

import { HostEngine, HostEngineConfig } from '../../domain/HostEngine';
import { StateStore, GameStatus } from '../../infra/StateStore';
import type { Transport } from '../../infra/Transport';
import type { HostBroadcast } from '../../types/Broadcast';
import type { Storage } from '../../infra/Storage';
import type { Audio } from '../../infra/Audio';
import type { GameTemplate } from '../../../../models/Template';
import type { RoleId } from '../../../../models/roles';

// =============================================================================
// Test Fixtures
// =============================================================================

/** Captured broadcasts for verification */
let capturedBroadcasts: HostBroadcast[] = [];

function createMockTemplate(roles: RoleId[]): GameTemplate {
  return {
    numberOfPlayers: roles.length,
    roles,
    name: 'Night Flow Test Template',
  };
}

function createMockTransport(): jest.Mocked<Transport> {
  return {
    joinRoom: jest.fn(() => Promise.resolve()),
    leaveRoom: jest.fn(() => Promise.resolve()),
    broadcastAsHost: jest.fn((msg: HostBroadcast) => {
      capturedBroadcasts.push(msg);
      return Promise.resolve();
    }),
    sendToHost: jest.fn(() => Promise.resolve(true)),
    setConnectionStatus: jest.fn(),
    getConnectionStatus: jest.fn(() => 'live'),
    reset: jest.fn(),
  } as unknown as jest.Mocked<Transport>;
}

function createMockStorage(): jest.Mocked<Storage> {
  return {
    save: jest.fn(() => Promise.resolve(true)),
    load: jest.fn(() => Promise.resolve(null)),
    clear: jest.fn(() => Promise.resolve()),
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

async function setupReadyGame(
  fixture: ReturnType<typeof createHostEngine>,
  roles: RoleId[],
): Promise<void> {
  const template = createMockTemplate(roles);
  await fixture.engine.initialize('NIGHT01', 'host-uid', template);

  // Seat all players
  for (let i = 0; i < roles.length; i++) {
    if (i === 0) {
      await fixture.engine.getPlayerActions().takeSeat(i, 'host-uid', `Player${i}`);
    } else {
      await fixture.engine.handlePlayerMessage(
        { type: 'JOIN', seat: i, uid: `player${i}-uid`, displayName: `Player${i}` },
        `player${i}-uid`,
      );
    }
  }

  // Assign roles
  await fixture.engine.assignRoles();

  // All view roles
  for (let i = 0; i < roles.length; i++) {
    if (i === 0) {
      await fixture.engine.getPlayerActions().viewedRole(i);
    } else {
      await fixture.engine.handlePlayerMessage({ type: 'VIEWED_ROLE', seat: i }, `player${i}-uid`);
    }
  }
}

function findBroadcast(type: string): HostBroadcast | undefined {
  return capturedBroadcasts.find((msg) => msg.type === type);
}

function findAllBroadcasts(type: string): HostBroadcast[] {
  return capturedBroadcasts.filter((msg) => msg.type === type);
}

// =============================================================================
// Tests
// =============================================================================

describe('HostEngine Night Flow Contract', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    capturedBroadcasts = [];
  });

  // ---------------------------------------------------------------------------
  // C1: startGame broadcasts STATE_UPDATE with ongoing status
  // ---------------------------------------------------------------------------

  describe('C1: startGame broadcasts STATE_UPDATE with ongoing status', () => {
    it('should broadcast STATE_UPDATE with status=ongoing', async () => {
      const fixture = createHostEngine();
      await setupReadyGame(fixture, ['wolf', 'seer', 'villager']);

      capturedBroadcasts = []; // Clear previous broadcasts
      await fixture.engine.startGame();

      const stateUpdates = findAllBroadcasts('STATE_UPDATE') as Array<{
        type: 'STATE_UPDATE';
        state: { status: string };
      }>;
      expect(stateUpdates.length).toBeGreaterThanOrEqual(1);

      const ongoingUpdate = stateUpdates.find((msg) => msg.state?.status === 'ongoing');
      expect(ongoingUpdate).toBeDefined();
    });
  });

  // ---------------------------------------------------------------------------
  // C2: startGame plays night begin audio
  // ---------------------------------------------------------------------------

  describe('C2: startGame plays night begin audio', () => {
    it('should play night begin audio', async () => {
      const fixture = createHostEngine();
      await setupReadyGame(fixture, ['wolf', 'seer', 'villager']);

      await fixture.engine.startGame();

      expect(fixture.audio.playNightBegin).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // C3: startGame broadcasts ROLE_TURN for first role
  // ---------------------------------------------------------------------------

  describe('C3: startGame broadcasts ROLE_TURN for first role', () => {
    it('should broadcast ROLE_TURN after night begin', async () => {
      const fixture = createHostEngine();
      await setupReadyGame(fixture, ['wolf', 'seer', 'villager']);

      capturedBroadcasts = [];
      await fixture.engine.startGame();

      const roleTurns = findAllBroadcasts('ROLE_TURN') as Array<{
        type: 'ROLE_TURN';
        role: RoleId;
      }>;
      expect(roleTurns.length).toBeGreaterThanOrEqual(1);

      // First role in night order should be broadcast
      const firstRoleTurn = roleTurns[0];
      expect(firstRoleTurn.role).toBeDefined();
    });

    it('should play role begin audio', async () => {
      const fixture = createHostEngine();
      await setupReadyGame(fixture, ['wolf', 'seer', 'villager']);

      await fixture.engine.startGame();

      expect(fixture.audio.playRoleBegin).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // C4: correct action writes to state.actions
  // ---------------------------------------------------------------------------

  describe('C4: correct action writes to state.actions', () => {
    it('should record wolf vote from a wolf player during night', async () => {
      const fixture = createHostEngine();
      // Use wolf + seer so night doesn't end after wolf vote
      await setupReadyGame(fixture, ['wolf', 'seer', 'villager']);

      await fixture.engine.startGame();

      // Get current role from state or engine
      const state = fixture.stateStore.getState();
      expect(state?.status).toBe(GameStatus.ongoing);

      // Find the wolf seat
      let wolfSeat = -1;
      for (const [seat, player] of state?.players ?? []) {
        if (player?.role === 'wolf') {
          wolfSeat = seat;
          break;
        }
      }
      expect(wolfSeat).toBeGreaterThanOrEqual(0);

      // The wolf should be able to submit vote
      // Note: We check wolfVotes immediately after submission, before night ends
      const wolfUid = wolfSeat === 0 ? 'host-uid' : `player${wolfSeat}-uid`;
      await fixture.engine.handlePlayerMessage(
        { type: 'WOLF_VOTE', seat: wolfSeat, target: 1 },
        wolfUid,
      );

      // Since there's only one wolf, the action completes the wolf turn
      // The vote is recorded in actions, not wolfVotes (wolfVotes is for multi-wolf consensus)
      // After wolf turn completes, the action is recorded
      const updatedState = fixture.stateStore.getState();

      // For single wolf, the wolf action should be recorded in actions map
      // Check that wolf action was recorded (actions map contains wolf entry)
      expect(updatedState?.actions.has('wolf')).toBe(true);
    });
  });

  // ---------------------------------------------------------------------------
  // C5: wrong role action is rejected
  // ---------------------------------------------------------------------------

  describe('C5: wrong role action is rejected', () => {
    it('should not record action when role does not match current turn', async () => {
      const fixture = createHostEngine();
      await setupReadyGame(fixture, ['wolf', 'seer', 'villager']);

      await fixture.engine.startGame();

      // Get the current role
      const state = fixture.stateStore.getState();
      const firstRole = state?.currentActionerIndex;

      // Try to submit action for a role that is not current
      // This should be ignored
      const wrongRole: RoleId = 'hunter'; // hunter is not in this game
      await fixture.engine.handlePlayerMessage(
        { type: 'ACTION', seat: 0, role: wrongRole, target: 1 },
        'host-uid',
      );

      // The action should not be recorded
      const updatedState = fixture.stateStore.getState();
      expect(updatedState?.actions.has(wrongRole)).toBe(false);
      expect(updatedState?.currentActionerIndex).toBe(firstRole);
    });
  });

  // ---------------------------------------------------------------------------
  // C6: callbacks are invoked
  // ---------------------------------------------------------------------------

  describe('C6: callbacks are invoked', () => {
    it('should call onRoleTurn callback', async () => {
      const fixture = createHostEngine();
      const onRoleTurn = jest.fn();
      fixture.engine.setCallbacks({ onRoleTurn });

      await setupReadyGame(fixture, ['wolf', 'seer', 'villager']);
      await fixture.engine.startGame();

      expect(onRoleTurn).toHaveBeenCalled();
    });
  });

  // ---------------------------------------------------------------------------
  // C7: game status transitions correctly
  // ---------------------------------------------------------------------------

  describe('C7: game status transitions correctly', () => {
    it('should be in ongoing status after startGame', async () => {
      const fixture = createHostEngine();
      await setupReadyGame(fixture, ['wolf', 'seer', 'villager']);

      await fixture.engine.startGame();

      const state = fixture.stateStore.getState();
      expect(state?.status).toBe(GameStatus.ongoing);
    });

    it('should only start from ready status', async () => {
      const fixture = createHostEngine();
      await fixture.engine.initialize('TEST01', 'host-uid', createMockTemplate(['wolf', 'villager']));

      // Try to start from unseated status
      await fixture.engine.startGame();

      const state = fixture.stateStore.getState();
      expect(state?.status).toBe(GameStatus.unseated); // Should not change
    });
  });

  // ---------------------------------------------------------------------------
  // C8: audio sequence is correct
  // ---------------------------------------------------------------------------

  describe('C8: audio sequence is correct', () => {
    it('should play audio in correct order', async () => {
      const fixture = createHostEngine();
      await setupReadyGame(fixture, ['wolf', 'villager', 'villager']);

      const audioCallOrder: string[] = [];
      fixture.audio.playNightBegin.mockImplementation(() => {
        audioCallOrder.push('nightBegin');
        return Promise.resolve();
      });
      fixture.audio.playRoleBegin.mockImplementation(() => {
        audioCallOrder.push('roleBegin');
        return Promise.resolve();
      });

      await fixture.engine.startGame();

      expect(audioCallOrder[0]).toBe('nightBegin');
      expect(audioCallOrder[1]).toBe('roleBegin');
    });
  });
});
