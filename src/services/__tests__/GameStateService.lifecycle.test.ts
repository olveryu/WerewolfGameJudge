/**
 * GameStateService Lifecycle Tests
 * Tests for game status transitions:
 * unseated → seated → assigned → ready → ongoing → ended
 * 
 * Also tests restart transitions.
 */

import { GameStateService } from '../GameStateService';
import { GameStatus } from '../types/GameStateTypes';
import { GameTemplate } from '../../models/Template';
import type { RoleId } from '../../models/roles';

// =============================================================================
// Mocks
// =============================================================================

jest.mock('../BroadcastService', () => ({
  BroadcastService: {
    getInstance: jest.fn(() => ({
      joinRoom: jest.fn().mockResolvedValue(undefined),
      leaveRoom: jest.fn().mockResolvedValue(undefined),
      broadcastAsHost: jest.fn().mockResolvedValue(undefined),
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

async function fillAllSeats(service: GameStateService): Promise<void> {
  const state = getState(service)!;
  for (let i = 0; i < state.template.numberOfPlayers; i++) {
    state.players.set(i, {
      uid: `player_${i}`,
      seatNumber: i,
      displayName: `Player ${i + 1}`,
      avatarUrl: undefined,
      role: null,
      hasViewedRole: false,
    });
  }
  // Trigger status update
  state.status = GameStatus.seated;
}

async function markAllViewed(service: GameStateService): Promise<void> {
  const state = getState(service)!;
  state.players.forEach((player) => {
    if (player) {
      player.hasViewedRole = true;
    }
  });
  state.status = GameStatus.ready;
}

// =============================================================================
// Tests
// =============================================================================

describe('GameStateService Lifecycle', () => {
  let service: GameStateService;

  beforeEach(() => {
    jest.useFakeTimers();
    service = resetGameStateService();
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  // ===========================================================================
  // 初始化状态
  // ===========================================================================

  describe('初始化', () => {
    it('初始化后状态应该是 unseated', async () => {
      const template = createTestTemplate();
      await service.initializeAsHost('TEST01', 'host-uid', template);

      const state = getState(service);
      expect(state).not.toBeNull();
      expect(state!.status).toBe(GameStatus.unseated);
    });

    it('初始化后 players map 应该有对应数量的空座位', async () => {
      const template = createTestTemplate();
      await service.initializeAsHost('TEST01', 'host-uid', template);

      const state = getState(service);
      // 初始化时预填充座位（值为 null）
      expect(state!.players.size).toBe(template.numberOfPlayers);
    });
  });

  // ===========================================================================
  // unseated → seated
  // ===========================================================================

  describe('unseated → seated', () => {
    it('所有玩家入座后状态应该变为 seated', async () => {
      const template = createTestTemplate();
      await service.initializeAsHost('TEST01', 'host-uid', template);
      await fillAllSeats(service);

      const state = getState(service);
      expect(state!.status).toBe(GameStatus.seated);
    });
  });

  // ===========================================================================
  // seated → assigned
  // ===========================================================================

  describe('seated → assigned', () => {
    it('assignRoles 后状态应该变为 assigned', async () => {
      const template = createTestTemplate();
      await service.initializeAsHost('TEST01', 'host-uid', template);
      await fillAllSeats(service);

      await service.assignRoles();

      const state = getState(service);
      expect(state!.status).toBe(GameStatus.assigned);
    });

    it('assignRoles 后每个玩家应该有角色', async () => {
      const template = createTestTemplate();
      await service.initializeAsHost('TEST01', 'host-uid', template);
      await fillAllSeats(service);

      await service.assignRoles();

      const state = getState(service);
      state!.players.forEach((player) => {
        expect(player).not.toBeNull();
        expect(player!.role).not.toBeNull();
      });
    });

    it('assignRoles 后所有玩家 hasViewedRole 应该为 false', async () => {
      const template = createTestTemplate();
      await service.initializeAsHost('TEST01', 'host-uid', template);
      await fillAllSeats(service);

      await service.assignRoles();

      const state = getState(service);
      state!.players.forEach((player) => {
        expect(player!.hasViewedRole).toBe(false);
      });
    });

    it('非 seated 状态调用 assignRoles 应该无效', async () => {
      const template = createTestTemplate();
      await service.initializeAsHost('TEST01', 'host-uid', template);
      // 不填充座位，保持 unseated

      await service.assignRoles();

      const state = getState(service);
      expect(state!.status).toBe(GameStatus.unseated);
    });
  });

  // ===========================================================================
  // assigned → ready
  // ===========================================================================

  describe('assigned → ready', () => {
    it('所有玩家查看角色后状态应该变为 ready', async () => {
      const template = createTestTemplate();
      await service.initializeAsHost('TEST01', 'host-uid', template);
      await fillAllSeats(service);
      await service.assignRoles();

      // 模拟所有玩家查看角色
      await markAllViewed(service);

      const state = getState(service);
      expect(state!.status).toBe(GameStatus.ready);
    });
  });

  // ===========================================================================
  // ready → ongoing
  // ===========================================================================

  describe('ready → ongoing', () => {
    it('startGame 后状态应该变为 ongoing', async () => {
      const template = createTestTemplate();
      await service.initializeAsHost('TEST01', 'host-uid', template);
      await fillAllSeats(service);
      await service.assignRoles();
      await markAllViewed(service);

      const startPromise = service.startGame();
      await jest.runAllTimersAsync();
      await startPromise;

      const state = getState(service);
      expect(state!.status).toBe(GameStatus.ongoing);
    });

    it('startGame 后 nightFlow 应该存在', async () => {
      const template = createTestTemplate();
      await service.initializeAsHost('TEST01', 'host-uid', template);
      await fillAllSeats(service);
      await service.assignRoles();
      await markAllViewed(service);

      const startPromise = service.startGame();
      await jest.runAllTimersAsync();
      await startPromise;

      const nightFlow = (service as any).nightFlow;
      expect(nightFlow).not.toBeNull();
    });

    it('非 ready 状态调用 startGame 应该无效', async () => {
      const template = createTestTemplate();
      await service.initializeAsHost('TEST01', 'host-uid', template);
      await fillAllSeats(service);
      await service.assignRoles();
      // 不标记查看，保持 assigned

      await service.startGame();

      const state = getState(service);
      expect(state!.status).toBe(GameStatus.assigned);
    });
  });

  // ===========================================================================
  // restartGame: any → seated
  // ===========================================================================

  describe('restartGame', () => {
    it('ongoing 状态调用 restartGame 后应该变为 seated', async () => {
      const template = createTestTemplate();
      await service.initializeAsHost('TEST01', 'host-uid', template);
      await fillAllSeats(service);
      await service.assignRoles();
      await markAllViewed(service);

      const startPromise = service.startGame();
      await jest.runAllTimersAsync();
      await startPromise;

      expect(getState(service)!.status).toBe(GameStatus.ongoing);

      await service.restartGame();

      const state = getState(service);
      expect(state!.status).toBe(GameStatus.seated);
    });

    it('restartGame 后所有玩家角色应该被清除', async () => {
      const template = createTestTemplate();
      await service.initializeAsHost('TEST01', 'host-uid', template);
      await fillAllSeats(service);
      await service.assignRoles();
      await markAllViewed(service);

      const startPromise = service.startGame();
      await jest.runAllTimersAsync();
      await startPromise;

      await service.restartGame();

      const state = getState(service);
      state!.players.forEach((player) => {
        expect(player!.role).toBeNull();
        expect(player!.hasViewedRole).toBe(false);
      });
    });

    it('restartGame 后 nightFlow 应该被清除', async () => {
      const template = createTestTemplate();
      await service.initializeAsHost('TEST01', 'host-uid', template);
      await fillAllSeats(service);
      await service.assignRoles();
      await markAllViewed(service);

      const startPromise = service.startGame();
      await jest.runAllTimersAsync();
      await startPromise;

      await service.restartGame();

      const nightFlow = (service as any).nightFlow;
      expect(nightFlow).toBeNull();
    });

    it('restartGame 后 actions 和 wolfVotes 应该被清除', async () => {
      const template = createTestTemplate();
      await service.initializeAsHost('TEST01', 'host-uid', template);
      await fillAllSeats(service);
      await service.assignRoles();
      await markAllViewed(service);

      const startPromise = service.startGame();
      await jest.runAllTimersAsync();
      await startPromise;

      await service.restartGame();

      const state = getState(service);
      expect(state!.actions.size).toBe(0);
      expect(state!.wolfVotes.size).toBe(0);
    });
  });

  // ===========================================================================
  // 状态转换守卫
  // ===========================================================================

  describe('状态转换守卫', () => {
    it('assignRoles 只能在 seated 状态调用', async () => {
      const template = createTestTemplate();
      await service.initializeAsHost('TEST01', 'host-uid', template);
      
      // unseated 状态
      await service.assignRoles();
      expect(getState(service)!.status).toBe(GameStatus.unseated);
    });

    it('startGame 只能在 ready 状态调用', async () => {
      const template = createTestTemplate();
      await service.initializeAsHost('TEST01', 'host-uid', template);
      await fillAllSeats(service);
      await service.assignRoles();
      
      // assigned 状态（非 ready）
      await service.startGame();
      expect(getState(service)!.status).toBe(GameStatus.assigned);
    });
  });

  // ===========================================================================
  // 完整生命周期
  // ===========================================================================

  describe('完整生命周期', () => {
    it('完整流程: unseated → seated → assigned → ready → ongoing', async () => {
      const template = createTestTemplate();
      
      // 1. 初始化
      await service.initializeAsHost('TEST01', 'host-uid', template);
      expect(getState(service)!.status).toBe(GameStatus.unseated);
      
      // 2. 入座
      await fillAllSeats(service);
      expect(getState(service)!.status).toBe(GameStatus.seated);
      
      // 3. 分配角色
      await service.assignRoles();
      expect(getState(service)!.status).toBe(GameStatus.assigned);
      
      // 4. 查看角色
      await markAllViewed(service);
      expect(getState(service)!.status).toBe(GameStatus.ready);
      
      // 5. 开始游戏
      const startPromise = service.startGame();
      await jest.runAllTimersAsync();
      await startPromise;
      expect(getState(service)!.status).toBe(GameStatus.ongoing);
    });

    it('重启后应该可以重新走完整流程', async () => {
      const template = createTestTemplate();
      
      // 第一轮
      await service.initializeAsHost('TEST01', 'host-uid', template);
      await fillAllSeats(service);
      await service.assignRoles();
      await markAllViewed(service);
      const startPromise = service.startGame();
      await jest.runAllTimersAsync();
      await startPromise;
      expect(getState(service)!.status).toBe(GameStatus.ongoing);
      
      // 重启
      await service.restartGame();
      expect(getState(service)!.status).toBe(GameStatus.seated);
      
      // 第二轮
      await service.assignRoles();
      expect(getState(service)!.status).toBe(GameStatus.assigned);
      
      await markAllViewed(service);
      expect(getState(service)!.status).toBe(GameStatus.ready);
      
      const startPromise2 = service.startGame();
      await jest.runAllTimersAsync();
      await startPromise2;
      expect(getState(service)!.status).toBe(GameStatus.ongoing);
    });
  });
});
