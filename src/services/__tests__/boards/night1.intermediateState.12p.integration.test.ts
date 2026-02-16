/**
 * Night-1 Intermediate State Assertions (12P Integration Test)
 *
 * 板子：标准板12人 (4 villager, 4 wolf, seer, witch, hunter, idiot)
 *
 * 目的：逐步执行 Night-1，在每一步 action 提交后断言 BroadcastGameState
 * 的关键字段，确保中间状态正确。填补现有测试只关注最终结果的盲区。
 *
 * 步骤顺序 (标准板12人): wolfKill → witchAction → hunterConfirm → seerCheck
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { doesRoleParticipateInWolfVote } from '@werewolf/game-engine/models/roles';

import { cleanupHostGame, createHostGame } from './hostGameFactory';
import { sendMessageOrThrow } from './stepByStepRunner';

// =============================================================================
// Constants
// =============================================================================

const TEMPLATE_NAME = '标准板12人';

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

describe('Night-1: intermediate state assertions (标准板12人)', () => {
  afterEach(() => {
    cleanupHostGame();
  });

  it('逐步断言每个步骤完成后的 BroadcastGameState', () => {
    const ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

    // --- 初始状态 ---
    const s0 = ctx.getBroadcastState();
    expect(s0.status).toBe('ongoing');
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
        sendMessageOrThrow(ctx, { type: 'WOLF_VOTE', seat, target: 0 }, 'wolfKill');
      }
    }

    // Verify wolf votes recorded
    const afterWolfVotes = ctx.getBroadcastState();
    const wolfVotes = afterWolfVotes.currentNightResults?.wolfVotesBySeat ?? {};
    expect(Object.keys(wolfVotes).length).toBe(4);
    // All wolves voted for seat 0
    for (const target of Object.values(wolfVotes)) {
      expect(target).toBe(0);
    }

    // Submit wolf lead action
    sendMessageOrThrow(
      ctx,
      { type: 'ACTION', seat: 4, role: 'wolf', target: 0, extra: undefined },
      'wolfKill lead',
    );

    const afterWolfAction = ctx.getBroadcastState();
    // Wolf action should be recorded in actions array
    expect(afterWolfAction.actions?.length).toBeGreaterThanOrEqual(1);
    const wolfAction = afterWolfAction.actions?.find((a: any) => a.schemaId === 'wolfKill');
    expect(wolfAction).toBeDefined();
    expect(wolfAction?.targetSeat).toBe(0);

    // Advance past wolfKill
    ctx.advanceNightOrThrow('past wolfKill');

    // --- Step 2: witchAction ---
    ctx.assertStep('witchAction');

    const beforeWitch = ctx.getBroadcastState();
    // Witch should see who was killed
    expect(beforeWitch.witchContext).toBeDefined();
    expect(beforeWitch.witchContext?.killedSeat).toBe(0);

    // Witch skips (no save, no poison)
    sendMessageOrThrow(
      ctx,
      {
        type: 'ACTION',
        seat: 9,
        role: 'witch',
        target: null,
        extra: { stepResults: { save: null, poison: null } },
      },
      'witchAction',
    );

    const afterWitch = ctx.getBroadcastState();
    const witchAction = afterWitch.actions?.find((a: any) => a.schemaId === 'witchAction');
    expect(witchAction).toBeDefined();

    ctx.advanceNightOrThrow('past witchAction');

    // --- Step 3: hunterConfirm ---
    ctx.assertStep('hunterConfirm');

    const beforeHunter = ctx.getBroadcastState();
    // confirmStatus should be set for hunter
    expect(beforeHunter.confirmStatus).toBeDefined();
    expect(beforeHunter.confirmStatus?.role).toBe('hunter');

    sendMessageOrThrow(
      ctx,
      { type: 'ACTION', seat: 10, role: 'hunter', target: null, extra: { confirmed: true } },
      'hunterConfirm',
    );

    const afterHunter = ctx.getBroadcastState();
    const hunterAction = afterHunter.actions?.find((a: any) => a.schemaId === 'hunterConfirm');
    expect(hunterAction).toBeDefined();

    ctx.advanceNightOrThrow('past hunterConfirm');

    // --- Step 4: seerCheck ---
    ctx.assertStep('seerCheck');

    // Seer checks seat 1 (villager → should be 'good')
    sendMessageOrThrow(
      ctx,
      { type: 'ACTION', seat: 8, role: 'seer', target: 1, extra: undefined },
      'seerCheck',
    );

    const afterSeer = ctx.getBroadcastState();
    const seerAction = afterSeer.actions?.find((a: any) => a.schemaId === 'seerCheck');
    expect(seerAction).toBeDefined();

    // seerReveal should be populated
    expect(afterSeer.seerReveal).toBeDefined();
    expect(afterSeer.seerReveal?.targetSeat).toBe(1);
    expect(afterSeer.seerReveal?.result).toBe('好人');

    // pendingRevealAcks should have seerCheck
    expect(afterSeer.pendingRevealAcks?.length).toBeGreaterThan(0);

    // Ack the reveal
    sendMessageOrThrow(ctx, { type: 'REVEAL_ACK', seat: 8, role: 'seer', revision: 0 }, 'seer ack');

    const afterAck = ctx.getBroadcastState();
    expect(afterAck.pendingRevealAcks?.length ?? 0).toBe(0);

    ctx.advanceNightOrThrow('past seerCheck');

    // --- Night should end ---
    const endState = ctx.getBroadcastState();
    expect(endState.currentStepId).toBeUndefined();

    ctx.endNight();

    const finalState = ctx.getBroadcastState();
    expect(finalState.status).toBe('ended');
    // Seat 0 should have died (wolf killed, witch didn't save)
    expect(finalState.lastNightDeaths).toContain(0);
  });

  it('witch 救人后 → lastNightDeaths 不含被救座位', () => {
    const ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

    // wolfKill: target seat 0
    const s0 = ctx.getBroadcastState();
    for (const [seatStr, player] of Object.entries(s0.players)) {
      const seat = Number.parseInt(seatStr, 10);
      if (player?.role && doesRoleParticipateInWolfVote(player.role)) {
        sendMessageOrThrow(ctx, { type: 'WOLF_VOTE', seat, target: 0 }, 'wolfKill');
      }
    }
    sendMessageOrThrow(
      ctx,
      { type: 'ACTION', seat: 4, role: 'wolf', target: 0, extra: undefined },
      'wolfKill',
    );
    ctx.advanceNightOrThrow('past wolfKill');

    // witchAction: save seat 0
    ctx.assertStep('witchAction');
    sendMessageOrThrow(
      ctx,
      {
        type: 'ACTION',
        seat: 9,
        role: 'witch',
        target: null,
        extra: { stepResults: { save: 0, poison: null } },
      },
      'witchAction save',
    );
    ctx.advanceNightOrThrow('past witchAction');

    // hunterConfirm
    ctx.assertStep('hunterConfirm');
    sendMessageOrThrow(
      ctx,
      { type: 'ACTION', seat: 10, role: 'hunter', target: null, extra: { confirmed: true } },
      'hunterConfirm',
    );
    ctx.advanceNightOrThrow('past hunterConfirm');

    // seerCheck
    ctx.assertStep('seerCheck');
    sendMessageOrThrow(
      ctx,
      { type: 'ACTION', seat: 8, role: 'seer', target: 1, extra: undefined },
      'seerCheck',
    );
    sendMessageOrThrow(ctx, { type: 'REVEAL_ACK', seat: 8, role: 'seer', revision: 0 }, 'seer ack');
    ctx.advanceNightOrThrow('past seerCheck');

    ctx.endNight();

    const finalState = ctx.getBroadcastState();
    expect(finalState.status).toBe('ended');
    // Seat 0 was saved by witch → should NOT be in deaths
    expect(finalState.lastNightDeaths).not.toContain(0);
  });

  it('witch 毒人后 → lastNightDeaths 包含毒杀目标', () => {
    const ctx = createHostGame(TEMPLATE_NAME, createRoleAssignment());

    // wolfKill: target seat 0
    const s0 = ctx.getBroadcastState();
    for (const [seatStr, player] of Object.entries(s0.players)) {
      const seat = Number.parseInt(seatStr, 10);
      if (player?.role && doesRoleParticipateInWolfVote(player.role)) {
        sendMessageOrThrow(ctx, { type: 'WOLF_VOTE', seat, target: 0 }, 'wolfKill');
      }
    }
    sendMessageOrThrow(
      ctx,
      { type: 'ACTION', seat: 4, role: 'wolf', target: 0, extra: undefined },
      'wolfKill',
    );
    ctx.advanceNightOrThrow('past wolfKill');

    // witchAction: don't save, poison seat 2
    ctx.assertStep('witchAction');
    sendMessageOrThrow(
      ctx,
      {
        type: 'ACTION',
        seat: 9,
        role: 'witch',
        target: null,
        extra: { stepResults: { save: null, poison: 2 } },
      },
      'witchAction poison',
    );
    ctx.advanceNightOrThrow('past witchAction');

    // hunterConfirm
    ctx.assertStep('hunterConfirm');
    sendMessageOrThrow(
      ctx,
      { type: 'ACTION', seat: 10, role: 'hunter', target: null, extra: { confirmed: true } },
      'hunterConfirm',
    );
    ctx.advanceNightOrThrow('past hunterConfirm');

    // seerCheck
    ctx.assertStep('seerCheck');
    sendMessageOrThrow(
      ctx,
      { type: 'ACTION', seat: 8, role: 'seer', target: 1, extra: undefined },
      'seerCheck',
    );
    sendMessageOrThrow(ctx, { type: 'REVEAL_ACK', seat: 8, role: 'seer', revision: 0 }, 'seer ack');
    ctx.advanceNightOrThrow('past seerCheck');

    ctx.endNight();

    const finalState = ctx.getBroadcastState();
    expect(finalState.status).toBe('ended');
    // Seat 0 killed by wolf, seat 2 poisoned by witch
    expect(finalState.lastNightDeaths).toContain(0);
    expect(finalState.lastNightDeaths).toContain(2);
  });
});
