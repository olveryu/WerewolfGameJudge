/**
 * GameStateService Audio State Tests
 * 
 * Tests for isAudioPlaying state transitions during night flow.
 */

import { GameStateService, GameStatus } from '../GameStateService';
import { NightPhase, NightEvent } from '../NightFlowController';
import { GameTemplate } from '../../models/Template';
import { RoleName } from '../../models/roles';

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

function createTestTemplate(roles: RoleName[]): GameTemplate {
  const paddedRoles: RoleName[] = [...roles];
  while (paddedRoles.length < 6) {
    paddedRoles.push('villager');
  }
  
  return {
    name: 'Test Template',
    roles: paddedRoles,
    numberOfPlayers: paddedRoles.length,
  };
}

function resetGameStateService(): GameStateService {
  (GameStateService as any).instance = undefined;
  return GameStateService.getInstance();
}

async function setupReadyState(
  service: GameStateService,
  actionOrder: RoleName[] = ['wolf', 'witch', 'seer']
): Promise<void> {
  const template = createTestTemplate(actionOrder);
  
  await service.initializeAsHost('TEST01', 'host-uid', template);
  
  const state = service.getState()!;
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
  
  await service.assignRoles();
  
  state.players.forEach((player) => {
    if (player) {
      player.hasViewedRole = true;
    }
  });
  state.status = GameStatus.ready;
}

function getNightFlow(service: GameStateService): any {
  return (service as any).nightFlow;
}

// =============================================================================
// Tests
// =============================================================================

describe('GameStateService Audio State', () => {
  let service: GameStateService;

  beforeEach(() => {
    jest.useFakeTimers();
    service = resetGameStateService();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    jest.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('isAudioPlaying 状态转换', () => {
    it('夜晚开始时 isAudioPlaying 应该为 true', async () => {
      await setupReadyState(service, ['wolf']);
      
      const startPromise = service.startGame();
      
      // During night begin audio
      await jest.advanceTimersByTimeAsync(100);
      
      const state = service.getState();
      // isAudioPlaying should be true during audio
      expect(state?.isAudioPlaying).toBe(true);
      
      await jest.runAllTimersAsync();
      await startPromise;
    });

    it('等待玩家行动时 isAudioPlaying 应该为 false', async () => {
      await setupReadyState(service, ['wolf']);
      
      const startPromise = service.startGame();
      await jest.runAllTimersAsync();
      await startPromise;
      
      // After all audio, waiting for action
      const nightFlow = getNightFlow(service);
      expect(nightFlow.phase).toBe(NightPhase.WaitingForAction);
      
      const state = service.getState();
      expect(state?.isAudioPlaying).toBe(false);
    });

    it('播放角色结束音频时 NightFlow phase 应该为 RoleEndAudio', async () => {
      await setupReadyState(service, ['wolf', 'witch']);
      
      const startPromise = service.startGame();
      await jest.runAllTimersAsync();
      await startPromise;
      
      // Simulate wolf action
      const nightFlow = getNightFlow(service);
      expect(nightFlow.phase).toBe(NightPhase.WaitingForAction);
      expect(nightFlow.currentRole).toBe('wolf');
      
      // Dispatch action submitted
      nightFlow.dispatch(NightEvent.ActionSubmitted);
      
      // Now should be playing role ending audio
      expect(nightFlow.phase).toBe(NightPhase.RoleEndAudio);
      
      // Note: isAudioPlaying is set by GameStateService.advanceToNextAction(),
      // not by directly dispatching to nightFlow. This test verifies the phase transition.
    });
  });

  describe('音频播放期间的状态保护', () => {
    it('游戏状态在 startGame 后应该是 ongoing', async () => {
      await setupReadyState(service, ['wolf']);
      
      const startPromise = service.startGame();
      await jest.runAllTimersAsync();
      await startPromise;
      
      const state = service.getState();
      expect(state?.status).toBe(GameStatus.ongoing);
    });
  });
});
