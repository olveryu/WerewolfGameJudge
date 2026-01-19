/**
 * GameStateService Wolf Vote Rejection Tests
 *
 * Tests for wolf vote rejection via gameState.actionRejected.
 * After refactor: rejection is stored in gameState instead of private messages.
 *
 * Note: These tests use the DeathCalculator immunity tests as the source of truth
 * for spiritKnight/wolfQueen immunity. The wolf vote rejection at UI level is
 * tested here via gameState.actionRejected.
 */

import { createHostGame, cleanupHostGame, HostGameContext } from './boards/hostGameFactory';
import { RoleId } from '../../models/roles';
import { GameStatus } from '../GameStateService';
import { NightPhase, NightEvent } from '../NightFlowController';

// =============================================================================
// Test Fixtures
// =============================================================================

function createStandardRoleAssignment(): Map<number, RoleId> {
  const assignment = new Map<number, RoleId>();
  assignment.set(0, 'villager');
  assignment.set(1, 'villager');
  assignment.set(2, 'villager');
  assignment.set(3, 'villager');
  assignment.set(4, 'wolf');
  assignment.set(5, 'wolf');
  assignment.set(6, 'wolf');
  assignment.set(7, 'seer');
  assignment.set(8, 'witch');
  assignment.set(9, 'hunter');
  assignment.set(10, 'guard');
  assignment.set(11, 'villager');
  return assignment;
}

function createSpiritKnightRoleAssignment(): Map<number, RoleId> {
  const assignment = new Map<number, RoleId>();
  assignment.set(0, 'villager');
  assignment.set(1, 'villager');
  assignment.set(2, 'villager');
  assignment.set(3, 'villager');
  assignment.set(4, 'wolf');
  assignment.set(5, 'wolf');
  assignment.set(6, 'spiritKnight'); // immune to wolf kill
  assignment.set(7, 'seer');
  assignment.set(8, 'witch');
  assignment.set(9, 'hunter');
  assignment.set(10, 'guard');
  assignment.set(11, 'wolf'); // Third wolf in seat 11
  return assignment;
}

function createWolfQueenRoleAssignment(): Map<number, RoleId> {
  const assignment = new Map<number, RoleId>();
  assignment.set(0, 'villager');
  assignment.set(1, 'villager');
  assignment.set(2, 'villager');
  assignment.set(3, 'villager');
  assignment.set(4, 'wolf');
  assignment.set(5, 'wolf');
  assignment.set(6, 'wolfQueen'); // immune to wolf kill
  assignment.set(7, 'seer');
  assignment.set(8, 'witch');
  assignment.set(9, 'hunter');
  assignment.set(10, 'guard');
  assignment.set(11, 'villager');
  return assignment;
}

// Helper: advance nightFlow to wolf's WaitingForAction phase
// This must update BOTH nightFlow AND GameStateService.state to stay in sync
async function advanceToWolfTurn(ctx: HostGameContext): Promise<void> {
  const nightFlow = ctx.getNightFlow();
  if (!nightFlow) return;

  while (!nightFlow.isTerminal()) {
    // Advance through audio phases
    if (nightFlow.phase === NightPhase.NightBeginAudio) {
      nightFlow.dispatch(NightEvent.NightBeginAudioDone);
      continue;
    }
    if (nightFlow.phase === NightPhase.RoleBeginAudio) {
      nightFlow.dispatch(NightEvent.RoleBeginAudioDone);
      continue;
    }

    // Check if we're at wolf's turn
    if (nightFlow.phase === NightPhase.WaitingForAction && nightFlow.currentRole === 'wolf') {
      return; // We're at wolf turn!
    }

    // If waiting for action but not wolf, use submitAction to properly sync state
    if (nightFlow.phase === NightPhase.WaitingForAction) {
      await ctx.submitAction(null); // Skip this role's action
      continue;
    }

    // Advance through other audio phases
    if (nightFlow.phase === NightPhase.RoleEndAudio) {
      nightFlow.dispatch(NightEvent.RoleEndAudioDone);
      continue;
    }

    break; // Safety break
  }
}

// =============================================================================
// Tests
// =============================================================================

describe('GameStateService Wolf Vote Rejection (gameState.actionRejected)', () => {
  let ctx: HostGameContext;

  afterEach(() => {
    cleanupHostGame();
  });

  describe('immune to wolf kill rejection', () => {
    it('狼人投恶灵骑士应被拒绝', async () => {
      // Use 恶灵骑士12人 template which has spiritKnight
      const TEMPLATE = '恶灵骑士12人';
      ctx = await createHostGame(TEMPLATE, createSpiritKnightRoleAssignment());

      const state = ctx.getState();
      expect(state?.status).toBe(GameStatus.ongoing);

      // Advance to wolf turn
      await advanceToWolfTurn(ctx);

      // Try to wolf vote on spiritKnight (seat 6)
      const wolfSeat = 4;
      const spiritKnightSeat = 6;

      await ctx.sendWolfVote(wolfSeat, spiritKnightSeat);

      // After rejection, actionRejected should be set in gameState
      const stateAfter = ctx.getState();
      expect(stateAfter?.actionRejected).toBeDefined();
      expect(stateAfter?.actionRejected?.action).toBe('submitWolfVote');
      expect(stateAfter?.actionRejected?.reason).toContain('恶灵骑士');
    });

    it('狼人投狼美人应被拒绝', async () => {
      // Use 标准板12人 template and inject wolfQueen
      const TEMPLATE = '标准板12人';
      ctx = await createHostGame(TEMPLATE, createWolfQueenRoleAssignment());

      // Advance to wolf turn
      await advanceToWolfTurn(ctx);

      const wolfSeat = 4;
      const wolfQueenSeat = 6;

      await ctx.sendWolfVote(wolfSeat, wolfQueenSeat);

      const stateAfter = ctx.getState();
      expect(stateAfter?.actionRejected).toBeDefined();
      expect(stateAfter?.actionRejected?.action).toBe('submitWolfVote');
      expect(stateAfter?.actionRejected?.reason).toContain('狼美人');
    });
  });

  describe('valid wolf votes', () => {
    it('狼人投村民应成功', async () => {
      const TEMPLATE = '标准板12人';
      ctx = await createHostGame(TEMPLATE, createStandardRoleAssignment());

      // Advance to wolf turn
      await advanceToWolfTurn(ctx);

      const wolfSeat = 4;
      const villagerSeat = 0;

      await ctx.sendWolfVote(wolfSeat, villagerSeat);

      // Vote should be recorded, no rejection
      const stateAfter = ctx.getState();
      // actionRejected should NOT be set for valid vote
      expect(stateAfter?.wolfVotes.has(wolfSeat)).toBe(true);
    });
  });
});
