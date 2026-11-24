/**
 * Night-1 Intermediate State Assertions (12P Integration Test)
 *
 * Board: SeerWitchHunterIdiot (4 villager, 4 wolf, seer, witch, hunter, idiot)
 *
 * Purpose: step through Night-1 and assert key GameState fields after each action,
 * ensuring intermediate states are correct. Fills the gap left by tests that only check final results.
 *
 * Step order (SeerWitchHunterIdiot): wolfKill → witchAction → hunterConfirm → seerCheck
 */

import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import {
  doesRoleParticipateInWolfVote,
  GameStatus,
  getWerewolfViewModel,
} from '@game-judge/game-engine/games/werewolf/public';
import {
  STEP_RESULT_ACK_ACTION_KEY,
  STEP_SKIP_ACTION_KEY,
} from '@game-judge/game-engine/platform/steps';

import { cleanupGame, createGame } from './gameFactory';
import { submitActionOrThrow, submitStep } from './stepByStepRunner';

// =============================================================================
// Constants
// =============================================================================

const TEMPLATE_NAME = '预女猎白';

function createRoleAssignment(): Map<number, RoleId> {
  const map = new Map<number, RoleId>();
  // seat 0-3: villager, seat 4-7: wolf, seat 8: seer, seat 9: witch, seat 10: hunter, seat 11: idiot
  [
    'villager',
    'villager',
    'villager',
    'villager',
    'wolf',
    'wolf',
    'wolf',
    'wolf',
    'seer',
    'witch',
    'hunter',
    'idiot',
  ].forEach((role, idx) => map.set(idx, role as RoleId));
  return map;
}

// =============================================================================
// Tests
// =============================================================================

describe('Night-1: intermediate state assertions (预女猎白)', () => {
  afterEach(() => {
    cleanupGame();
  });

  it('逐步断言每个步骤完成后的 GameState', () => {
    const ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

    // --- Initial state ---
    const s0 = ctx.getGameState();
    expect(s0.status).toBe(GameStatus.Ongoing);
    expect(s0.nightStep).toEqual({ kind: 'inStep', stepId: 'wolfKill' });
    expect(s0.isAudioPlaying).toBe(false);
    expect(s0.nightState?.slice.records).toEqual({});
    expect(s0.lastNightDeaths).toBeUndefined();

    // --- Step 1: wolfKill ---
    ctx.assertStep('wolfKill');

    // Submit wolf votes (all wolves target seat 0)
    for (const [seatStr, player] of Object.entries(s0.players)) {
      const seat = Number.parseInt(seatStr, 10);
      if (player?.role && doesRoleParticipateInWolfVote(player.role)) {
        submitActionOrThrow(ctx, seat, { kind: 'target', target: 0 }, 'wolfKill');
      }
    }

    // Verify wolf votes recorded
    const afterWolfVotes = ctx.getGameState();
    expect(afterWolfVotes.nightState?.facts.wolfVotes).toEqual(
      [4, 5, 6, 7].map((actorSeat) => ({ actorSeat, chosenSeat: 0, landingSeat: 0 })),
    );

    const wolfVoteDeadline =
      afterWolfVotes.nightStep?.kind === 'inStep'
        ? afterWolfVotes.nightStep.stepDeadline
        : undefined;
    if (wolfVoteDeadline === undefined) {
      throw new Error('[FAIL-FAST] Completed wolf vote must set a progression deadline');
    }
    ctx.dispatchSystemOrThrow({ type: 'werewolf.phase.settleExpired' }, 'past wolfKill deadline', {
      nowMs: wolfVoteDeadline,
    });

    // --- Step 2: witchAction ---
    ctx.assertStep('witchAction');

    const beforeWitch = ctx.getGameState();
    expect(beforeWitch.isAudioPlaying).toBe(true);
    expect(getWerewolfViewModel(beforeWitch, { seat: 9, isHost: false }).step?.message).toContain(
      '1号被狼人袭击',
    );
    ctx.acknowledgePendingAudioOrThrow('complete wolfKill to witchAction audio');

    // Witch skips (no save, no poison)
    submitActionOrThrow(ctx, 9, { kind: 'skip' }, 'witchAction');

    const afterWitch = ctx.getGameState();
    expect(afterWitch.nightState?.slice.records.witchAction?.bySeat[9]?.submissions).toContainEqual(
      {
        actionKey: STEP_SKIP_ACTION_KEY,
        seats: [],
        cardIndex: null,
      },
    );

    // --- Step 3: hunterConfirm ---
    ctx.assertStep('hunterConfirm');

    const beforeHunter = ctx.getGameState();
    expect(beforeHunter.isAudioPlaying).toBe(true);
    const hunterStep = getWerewolfViewModel(beforeHunter, { seat: 10, isHost: false }).step;
    const hunterView = hunterStep?.actions.find((action) => action.kind === 'view');
    expect(hunterView?.kind === 'view' && hunterView.content.text).toBe('可以发动技能');
    ctx.acknowledgePendingAudioOrThrow('complete witchAction to hunterConfirm audio');

    submitActionOrThrow(ctx, 10, { kind: 'confirm' }, 'hunterConfirm');

    const afterHunter = ctx.getGameState();
    expect(
      afterHunter.nightState?.slice.records.hunterConfirm?.bySeat[10]?.submissions,
    ).toContainEqual({
      actionKey: 'hunterConfirm',
      seats: [],
      cardIndex: null,
    });

    // --- Step 4: seerCheck ---
    ctx.assertStep('seerCheck');
    expect(afterHunter.isAudioPlaying).toBe(true);
    ctx.acknowledgePendingAudioOrThrow('complete hunterConfirm to seerCheck audio');

    // Seer checks seat 1 (villager → should be 'good')
    submitActionOrThrow(ctx, 8, { kind: 'target', target: 1 }, 'seerCheck');

    const afterSeer = ctx.getGameState();
    expect(afterSeer.nightState?.slice.records.seerCheck?.bySeat[8]?.result).toEqual({
      kind: 'factionCheck',
      chosenSeat: 1,
      landingSeat: 1,
      faction: 'good',
    });
    expect(
      getWerewolfViewModel(afterSeer, { seat: 8, isHost: false }).step?.pendingResult,
    ).toMatchObject({
      text: '2号是好人',
    });

    // Ack the reveal
    submitStep(ctx, 8, { actionKey: STEP_RESULT_ACK_ACTION_KEY }, 'seer ack');

    const afterAck = ctx.getGameState();
    expect(afterAck.nightState?.slice.records.seerCheck?.bySeat[8]?.isResultAcknowledged).toBe(
      true,
    );

    // --- Night should end ---
    expect(afterAck.nightStep).toBeNull();
    expect(afterAck.status).toBe(GameStatus.Ended);
    // Seat 0 should have died (wolf killed, witch didn't save)
    expect(afterAck.lastNightDeaths).toContain(0);
  });

  it('witch 救人后 → lastNightDeaths 不含被救座位', () => {
    const ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

    // wolfKill: target seat 0
    const s0 = ctx.getGameState();
    for (const [seatStr, player] of Object.entries(s0.players)) {
      const seat = Number.parseInt(seatStr, 10);
      if (player?.role && doesRoleParticipateInWolfVote(player.role)) {
        submitActionOrThrow(ctx, seat, { kind: 'target', target: 0 }, 'wolfKill');
      }
    }
    const wolfVoteState = ctx.getGameState();
    const wolfVoteDeadline =
      wolfVoteState.nightStep?.kind === 'inStep' ? wolfVoteState.nightStep.stepDeadline : undefined;
    if (wolfVoteDeadline === undefined) {
      throw new Error('[FAIL-FAST] Completed wolf vote must set a progression deadline');
    }
    ctx.dispatchSystemOrThrow({ type: 'werewolf.phase.settleExpired' }, 'past wolfKill deadline', {
      nowMs: wolfVoteDeadline,
    });
    ctx.acknowledgePendingAudioOrThrow('complete wolfKill to witchAction audio');

    // witchAction: save seat 0
    ctx.assertStep('witchAction');
    submitActionOrThrow(
      ctx,
      9,
      { kind: 'witch', saveTarget: 0, poisonTarget: null },
      'witchAction save',
    );
    ctx.acknowledgePendingAudioOrThrow('complete witchAction to hunterConfirm audio');

    // hunterConfirm
    ctx.assertStep('hunterConfirm');
    submitActionOrThrow(ctx, 10, { kind: 'confirm' }, 'hunterConfirm');
    ctx.acknowledgePendingAudioOrThrow('complete hunterConfirm to seerCheck audio');

    // seerCheck
    ctx.assertStep('seerCheck');
    submitActionOrThrow(ctx, 8, { kind: 'target', target: 1 }, 'seerCheck');
    submitStep(ctx, 8, { actionKey: STEP_RESULT_ACK_ACTION_KEY }, 'seer ack');

    const finalState = ctx.getGameState();
    expect(finalState.status).toBe(GameStatus.Ended);
    // Seat 0 was saved by witch → should NOT be in deaths
    expect(finalState.lastNightDeaths).not.toContain(0);
  });

  it('witch 毒人后 → lastNightDeaths 包含毒杀目标', () => {
    const ctx = createGame(TEMPLATE_NAME, createRoleAssignment());

    // wolfKill: target seat 0
    const s0 = ctx.getGameState();
    for (const [seatStr, player] of Object.entries(s0.players)) {
      const seat = Number.parseInt(seatStr, 10);
      if (player?.role && doesRoleParticipateInWolfVote(player.role)) {
        submitActionOrThrow(ctx, seat, { kind: 'target', target: 0 }, 'wolfKill');
      }
    }
    const wolfVoteState = ctx.getGameState();
    const wolfVoteDeadline =
      wolfVoteState.nightStep?.kind === 'inStep' ? wolfVoteState.nightStep.stepDeadline : undefined;
    if (wolfVoteDeadline === undefined) {
      throw new Error('[FAIL-FAST] Completed wolf vote must set a progression deadline');
    }
    ctx.dispatchSystemOrThrow({ type: 'werewolf.phase.settleExpired' }, 'past wolfKill deadline', {
      nowMs: wolfVoteDeadline,
    });
    ctx.acknowledgePendingAudioOrThrow('complete wolfKill to witchAction audio');

    // witchAction: don't save, poison seat 2
    ctx.assertStep('witchAction');
    submitActionOrThrow(
      ctx,
      9,
      { kind: 'witch', saveTarget: null, poisonTarget: 2 },
      'witchAction poison',
    );
    ctx.acknowledgePendingAudioOrThrow('complete witchAction to hunterConfirm audio');

    // hunterConfirm
    ctx.assertStep('hunterConfirm');
    submitActionOrThrow(ctx, 10, { kind: 'confirm' }, 'hunterConfirm');
    ctx.acknowledgePendingAudioOrThrow('complete hunterConfirm to seerCheck audio');

    // seerCheck
    ctx.assertStep('seerCheck');
    submitActionOrThrow(ctx, 8, { kind: 'target', target: 1 }, 'seerCheck');
    submitStep(ctx, 8, { actionKey: STEP_RESULT_ACK_ACTION_KEY }, 'seer ack');

    const finalState = ctx.getGameState();
    expect(finalState.status).toBe(GameStatus.Ended);
    // Seat 0 killed by wolf, seat 2 poisoned by witch
    expect(finalState.lastNightDeaths).toContain(0);
    expect(finalState.lastNightDeaths).toContain(2);
  });
});
