/**
 * GameStateService Wolf Vote Rejection Tests (Commit 3)
 * 
 * Tests for wolf vote input validation:
 * 1. spiritKnight cannot vote for self (actor-specific)
 * 2. Any wolf cannot vote for forbiddenTargetRoleIds (target-based)
 */

import { GameStateService, GameStatus } from '../GameStateService';
import { NightPhase } from '../NightFlowController';
import { GameTemplate } from '../../models/Template';
import { RoleName } from '../../models/roles';

// =============================================================================
// Mocks
// =============================================================================

const mockSendPrivate = jest.fn().mockResolvedValue(undefined);

jest.mock('../BroadcastService', () => ({
  BroadcastService: {
    getInstance: jest.fn(() => ({
      joinRoom: jest.fn().mockResolvedValue(undefined),
      leaveRoom: jest.fn().mockResolvedValue(undefined),
      broadcastAsHost: jest.fn().mockResolvedValue(undefined),
      broadcastPublic: jest.fn().mockResolvedValue(undefined),
      sendPrivate: mockSendPrivate,
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

function resetGameStateService(): GameStateService {
  (GameStateService as any).instance = undefined;
  return GameStateService.getInstance();
}

function createTestTemplate(roles: RoleName[]): GameTemplate {
  return {
    name: 'Test Template',
    roles,
    numberOfPlayers: roles.length,
  };
}

async function setupGameInWolfPhase(
  service: GameStateService,
  roles: RoleName[]
): Promise<void> {
  const template = createTestTemplate(roles);
  
  await service.initializeAsHost('TEST01', 'host-uid', template);
  
  const state = service.getState()!;
  for (let i = 0; i < roles.length; i++) {
    state.players.set(i, {
      uid: `player_${i}`,
      seatNumber: i,
      displayName: `Player ${i + 1}`,
      avatarUrl: undefined,
      role: roles[i],
      hasViewedRole: true,
    });
  }
  state.status = GameStatus.ready;
  
  // Start game
  const startPromise = service.startGame();
  await jest.runAllTimersAsync();
  await startPromise;
  
  // Advance to wolf phase (WaitingForAction)
  const nightFlow = (service as any).nightFlow;
  while (nightFlow.phase !== NightPhase.WaitingForAction && !nightFlow.isTerminal()) {
    if (nightFlow.phase === NightPhase.NightBeginAudio) {
      nightFlow.dispatch(1); // NightBeginAudioDone
    } else if (nightFlow.phase === NightPhase.RoleBeginAudio) {
      nightFlow.dispatch(2); // RoleBeginAudioDone
    }
    await jest.runOnlyPendingTimersAsync();
  }
  
  // Verify we're in wolf phase
  expect(nightFlow.phase).toBe(NightPhase.WaitingForAction);
  expect(nightFlow.currentRole).toBe('wolf');
}

function getNightFlow(service: GameStateService): any {
  return (service as any).nightFlow;
}

// =============================================================================
// Tests
// =============================================================================

describe('GameStateService Wolf Vote Rejection', () => {
  let service: GameStateService;

  beforeEach(() => {
    jest.useFakeTimers();
    service = resetGameStateService();
    mockSendPrivate.mockClear();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('spiritKnight self-vote rejection (actor-specific)', () => {
    it('spiritKnight投自己应被拒绝并发送ACTION_REJECTED私信', async () => {
      // Setup: Board with spiritKnight as one of the wolves
      const roles: RoleName[] = [
        'villager', 'villager', 'villager', 'villager',
        'wolf', 'wolf', 'spiritKnight',  // spiritKnight at seat 6
        'seer', 'witch', 'hunter'
      ];
      
      await setupGameInWolfPhase(service, roles);
      
      const spiritKnightSeat = 6;
      const state = service.getState()!;
      expect(state.players.get(spiritKnightSeat)?.role).toBe('spiritKnight');
      
      // Act: spiritKnight votes for self via handleWolfVote
      await (service as any).handleWolfVote(spiritKnightSeat, spiritKnightSeat);
      await jest.runOnlyPendingTimersAsync();
      
      // Assert: ACTION_REJECTED private message was sent
      expect(mockSendPrivate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PRIVATE_EFFECT',
          toUid: `player_${spiritKnightSeat}`,
          payload: expect.objectContaining({
            kind: 'ACTION_REJECTED',
            action: 'submitWolfVote',
            reason: '恶灵骑士不能投自己',
          }),
        })
      );
      
      // Assert: Vote was NOT recorded
      expect(state.wolfVotes.has(spiritKnightSeat)).toBe(false);
    });

    it('spiritKnight投其他人应该正常记录', async () => {
      const roles: RoleName[] = [
        'villager', 'villager', 'villager', 'villager',
        'wolf', 'wolf', 'spiritKnight',
        'seer', 'witch', 'hunter'
      ];
      
      await setupGameInWolfPhase(service, roles);
      
      const spiritKnightSeat = 6;
      const targetSeat = 0; // Vote for villager
      
      mockSendPrivate.mockClear();
      
      // Act: spiritKnight votes for someone else
      await (service as any).handleWolfVote(spiritKnightSeat, targetSeat);
      await jest.runOnlyPendingTimersAsync();
      
      // Assert: No rejection message
      expect(mockSendPrivate).not.toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            kind: 'ACTION_REJECTED',
          }),
        })
      );
      
      // Assert: Vote was recorded
      const state = service.getState()!;
      expect(state.wolfVotes.get(spiritKnightSeat)).toBe(targetSeat);
    });
  });

  describe('forbiddenTargetRoleIds rejection (target-based)', () => {
    it('普通狼投spiritKnight应被拒绝', async () => {
      const roles: RoleName[] = [
        'villager', 'villager', 'villager', 'villager',
        'wolf', 'wolf', 'spiritKnight',  // spiritKnight at seat 6
        'seer', 'witch', 'hunter'
      ];
      
      await setupGameInWolfPhase(service, roles);
      
      const wolfSeat = 4;
      const spiritKnightSeat = 6;
      
      mockSendPrivate.mockClear();
      
      // Act: Wolf votes for spiritKnight
      await (service as any).handleWolfVote(wolfSeat, spiritKnightSeat);
      await jest.runOnlyPendingTimersAsync();
      
      // Assert: ACTION_REJECTED private message was sent
      expect(mockSendPrivate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PRIVATE_EFFECT',
          toUid: `player_${wolfSeat}`,
          payload: expect.objectContaining({
            kind: 'ACTION_REJECTED',
            action: 'submitWolfVote',
            reason: '不能投恶灵骑士',
          }),
        })
      );
      
      // Assert: Vote was NOT recorded
      const state = service.getState()!;
      expect(state.wolfVotes.has(wolfSeat)).toBe(false);
    });

    it('普通狼投wolfQueen应被拒绝', async () => {
      const roles: RoleName[] = [
        'villager', 'villager', 'villager', 'villager',
        'wolf', 'wolf', 'wolfQueen',  // wolfQueen at seat 6
        'seer', 'witch', 'hunter'
      ];
      
      await setupGameInWolfPhase(service, roles);
      
      const wolfSeat = 4;
      const wolfQueenSeat = 6;
      
      mockSendPrivate.mockClear();
      
      // Act: Wolf votes for wolfQueen
      await (service as any).handleWolfVote(wolfSeat, wolfQueenSeat);
      await jest.runOnlyPendingTimersAsync();
      
      // Assert: ACTION_REJECTED private message was sent
      expect(mockSendPrivate).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'PRIVATE_EFFECT',
          toUid: `player_${wolfSeat}`,
          payload: expect.objectContaining({
            kind: 'ACTION_REJECTED',
            action: 'submitWolfVote',
            reason: '不能投狼美人',
          }),
        })
      );
      
      // Assert: Vote was NOT recorded
      const state = service.getState()!;
      expect(state.wolfVotes.has(wolfSeat)).toBe(false);
    });

    it('普通狼投村民应该正常记录', async () => {
      const roles: RoleName[] = [
        'villager', 'villager', 'villager', 'villager',
        'wolf', 'wolf', 'wolfQueen',
        'seer', 'witch', 'hunter'
      ];
      
      await setupGameInWolfPhase(service, roles);
      
      const wolfSeat = 4;
      const villagerSeat = 0;
      
      mockSendPrivate.mockClear();
      
      // Act: Wolf votes for villager
      await (service as any).handleWolfVote(wolfSeat, villagerSeat);
      await jest.runOnlyPendingTimersAsync();
      
      // Assert: No rejection message
      expect(mockSendPrivate).not.toHaveBeenCalledWith(
        expect.objectContaining({
          payload: expect.objectContaining({
            kind: 'ACTION_REJECTED',
          }),
        })
      );
      
      // Assert: Vote was recorded
      const state = service.getState()!;
      expect(state.wolfVotes.get(wolfSeat)).toBe(villagerSeat);
    });
  });
});
