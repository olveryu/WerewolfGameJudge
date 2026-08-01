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
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import { doesRoleParticipateInWolfVote } from '@game-judge/game-engine/games/werewolf/public';

import { cleanupGame, createGame } from './gameFactory';
import { submitActionOrThrow } from './stepByStepRunner';

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
    expect(s0.currentStepId).toBe('wolfKill');
    expect(s0.isAudioPlaying).toBe(false);
    expect(s0.actions).toEqual([]);
    expect(s0.pendingRevealAcks).toEqual([]);
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
    const wolfVotes = afterWolfVotes.currentNightResults?.wolfVotesBySeat ?? {};
    expect(Object.keys(wolfVotes).length).toBe(4);
    // All wolves voted for seat 0
    for (const target of Object.values(wolfVotes)) {
      expect(target).toBe(0);
    }

    // Wolf action should be recorded in actions array
    expect(afterWolfVotes.actions.length).toBeGreaterThanOrEqual(1);
    const wolfAction = afterWolfVotes.actions.find((a) => a.schemaId === 'wolfKill');
    expect(wolfAction).toBeDefined();
    expect(wolfAction?.targetSeat).toBe(0);

    const wolfVoteDeadline = afterWolfVotes.stepDeadline;
    if (wolfVoteDeadline === undefined) {
      throw new Error('[FAIL-FAST] Completed wolf vote must set a progression deadline');
    }
    ctx.dispatchOrThrow(
      { type: 'werewolf.progress.request' },
      'past wolfKill deadline',
      undefined,
      { nowMs: wolfVoteDeadline },
    );

    // --- Step 2: witchAction ---
    ctx.assertStep('witchAction');

    const beforeWitch = ctx.getGameState();
    expect(beforeWitch.isAudioPlaying).toBe(true);
    // Witch should see who was killed
    expect(beforeWitch.witchContext).toBeDefined();
    expect(beforeWitch.witchContext?.killedSeat).toBe(0);
    ctx.dispatchOrThrow({ type: 'werewolf.audio.ack' }, 'complete wolfKill to witchAction audio');

    // Witch skips (no save, no poison)
    submitActionOrThrow(ctx, 9, { kind: 'skip' }, 'witchAction');

    const afterWitch = ctx.getGameState();
    const witchAction = afterWitch.actions.find((a) => a.schemaId === 'witchAction');
    expect(witchAction).toBeDefined();

    // --- Step 3: hunterConfirm ---
    ctx.assertStep('hunterConfirm');

    const beforeHunter = ctx.getGameState();
    expect(beforeHunter.isAudioPlaying).toBe(true);
    // confirmStatus should be set for hunter
    expect(beforeHunter.confirmStatus).toBeDefined();
    expect(beforeHunter.confirmStatus?.role).toBe('hunter');
    ctx.dispatchOrThrow(
      { type: 'werewolf.audio.ack' },
      'complete witchAction to hunterConfirm audio',
    );

    submitActionOrThrow(ctx, 10, { kind: 'confirm' }, 'hunterConfirm');

    const afterHunter = ctx.getGameState();
    const hunterAction = afterHunter.actions.find((a) => a.schemaId === 'hunterConfirm');
    expect(hunterAction).toBeDefined();

    // --- Step 4: seerCheck ---
    ctx.assertStep('seerCheck');
    expect(afterHunter.isAudioPlaying).toBe(true);
    ctx.dispatchOrThrow(
      { type: 'werewolf.audio.ack' },
      'complete hunterConfirm to seerCheck audio',
    );

    // Seer checks seat 1 (villager → should be 'good')
    submitActionOrThrow(ctx, 8, { kind: 'target', target: 1 }, 'seerCheck');

    const afterSeer = ctx.getGameState();
    const seerAction = afterSeer.actions.find((a) => a.schemaId === 'seerCheck');
    expect(seerAction).toBeDefined();

    // seerReveal should be populated
    expect(afterSeer.seerReveal).toBeDefined();
    expect(afterSeer.seerReveal?.targetSeat).toBe(1);
    expect(afterSeer.seerReveal?.result).toBe('好人');

    // pendingRevealAcks should have seerCheck
    expect(afterSeer.pendingRevealAcks.length).toBeGreaterThan(0);

    // Ack the reveal
    ctx.dispatchAsSeatOrThrow(8, { type: 'werewolf.reveal.ack' }, 'seer ack');

    const afterAck = ctx.getGameState();
    expect(afterAck.pendingRevealAcks).toEqual([]);

    // --- Night should end ---
    expect(afterAck.currentStepId).toBeUndefined();
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
    const wolfVoteDeadline = ctx.getGameState().stepDeadline;
    if (wolfVoteDeadline === undefined) {
      throw new Error('[FAIL-FAST] Completed wolf vote must set a progression deadline');
    }
    ctx.dispatchOrThrow(
      { type: 'werewolf.progress.request' },
      'past wolfKill deadline',
      undefined,
      { nowMs: wolfVoteDeadline },
    );
    ctx.dispatchOrThrow({ type: 'werewolf.audio.ack' }, 'complete wolfKill to witchAction audio');

    // witchAction: save seat 0
    ctx.assertStep('witchAction');
    submitActionOrThrow(
      ctx,
      9,
      { kind: 'witch', saveTarget: 0, poisonTarget: null },
      'witchAction save',
    );
    ctx.dispatchOrThrow(
      { type: 'werewolf.audio.ack' },
      'complete witchAction to hunterConfirm audio',
    );

    // hunterConfirm
    ctx.assertStep('hunterConfirm');
    submitActionOrThrow(ctx, 10, { kind: 'confirm' }, 'hunterConfirm');
    ctx.dispatchOrThrow(
      { type: 'werewolf.audio.ack' },
      'complete hunterConfirm to seerCheck audio',
    );

    // seerCheck
    ctx.assertStep('seerCheck');
    submitActionOrThrow(ctx, 8, { kind: 'target', target: 1 }, 'seerCheck');
    ctx.dispatchAsSeatOrThrow(8, { type: 'werewolf.reveal.ack' }, 'seer ack');

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
    const wolfVoteDeadline = ctx.getGameState().stepDeadline;
    if (wolfVoteDeadline === undefined) {
      throw new Error('[FAIL-FAST] Completed wolf vote must set a progression deadline');
    }
    ctx.dispatchOrThrow(
      { type: 'werewolf.progress.request' },
      'past wolfKill deadline',
      undefined,
      { nowMs: wolfVoteDeadline },
    );
    ctx.dispatchOrThrow({ type: 'werewolf.audio.ack' }, 'complete wolfKill to witchAction audio');

    // witchAction: don't save, poison seat 2
    ctx.assertStep('witchAction');
    submitActionOrThrow(
      ctx,
      9,
      { kind: 'witch', saveTarget: null, poisonTarget: 2 },
      'witchAction poison',
    );
    ctx.dispatchOrThrow(
      { type: 'werewolf.audio.ack' },
      'complete witchAction to hunterConfirm audio',
    );

    // hunterConfirm
    ctx.assertStep('hunterConfirm');
    submitActionOrThrow(ctx, 10, { kind: 'confirm' }, 'hunterConfirm');
    ctx.dispatchOrThrow(
      { type: 'werewolf.audio.ack' },
      'complete hunterConfirm to seerCheck audio',
    );

    // seerCheck
    ctx.assertStep('seerCheck');
    submitActionOrThrow(ctx, 8, { kind: 'target', target: 1 }, 'seerCheck');
    ctx.dispatchAsSeatOrThrow(8, { type: 'werewolf.reveal.ack' }, 'seer ack');

    const finalState = ctx.getGameState();
    expect(finalState.status).toBe(GameStatus.Ended);
    // Seat 0 killed by wolf, seat 2 poisoned by witch
    expect(finalState.lastNightDeaths).toContain(0);
    expect(finalState.lastNightDeaths).toContain(2);
  });
});
