/** Avalon Worker bot-takeover gate: host-only, bot-seats-only (D6-Q3, §6.2). */

import type { AvalonPublicCommand, AvalonState } from '@game-judge/game-engine/games/avalon/public';
import {
  REASON_CONTROLLED_SEAT_NOT_BOT,
  REASON_NOT_HOST,
} from '@game-judge/game-engine/platform/protocol/reasons';
import { describe, expect, it } from 'vitest';

import { avalonWorkerModule } from '../module';

const HOST = 'host-1';

function decide(
  state: AvalonState,
  command: AvalonPublicCommand,
  userId: string,
  controlledSeat: number | null,
  commandId: string,
) {
  return avalonWorkerModule.decidePublic(state, command, {
    actor: { kind: 'user', userId },
    controlledSeat,
    nowMs: 1000,
    commandId,
    randomSeed: commandId,
  });
}

function commitState(
  state: AvalonState,
  command: AvalonPublicCommand,
  userId: string,
  controlledSeat: number | null,
  commandId: string,
): AvalonState {
  const decision = decide(state, command, userId, controlledSeat, commandId);
  if (decision.kind !== 'commit') throw new Error(`Expected commit: ${decision.reason}`);
  return decision.state;
}

/** Lobby with host seated at 0 and implicit bot seats 1-4, game started into night. */
function nightState(): AvalonState {
  const created = avalonWorkerModule.createInitialState(
    { numberOfPlayers: 5, voteMode: 'public', vetoLimit: 5 },
    { roomCode: '1234', hostUserId: HOST, nowMs: 1, commandId: 'create' },
  );
  if (created.kind !== 'created') throw new Error(created.reason);
  const filled = commitState(
    created.state,
    { type: 'room.seat.fillBots' },
    HOST,
    null,
    'fill-bots',
  );
  const seated = commitState(
    filled,
    { type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } },
    HOST,
    null,
    'seat-host',
  );
  const started = commitState(seated, { type: 'avalon.game.start' }, HOST, null, 'start');
  if (started.phase.kind !== 'night') throw new Error('Expected night phase');
  // 音频门控：先 ack 掉开局播报，否则 night.confirm 会被"播报尚未结束"拦截，
  // 盖掉 controlledSeat 门控的测试目标。
  let state = started;
  while (state.isAudioPlaying) {
    state = commitState(
      state,
      { type: 'avalon.audio.ack' },
      HOST,
      null,
      `ack-${state.pendingAudioEffects.length}`,
    );
  }
  return state;
}

describe('Avalon controlledSeat gate', () => {
  it('rejects a non-host takeover with REASON_NOT_HOST', () => {
    const state = nightState();
    const decision = decide(
      state,
      { type: 'avalon.night.confirm' },
      'intruder',
      1,
      'takeover-intruder',
    );
    expect(decision).toEqual({ kind: 'reject', reason: REASON_NOT_HOST });
  });

  it('rejects a host takeover of a real seat with REASON_CONTROLLED_SEAT_NOT_BOT', () => {
    const state = nightState();
    const decision = decide(state, { type: 'avalon.night.confirm' }, HOST, 0, 'takeover-real-seat');
    expect(decision).toEqual({ kind: 'reject', reason: REASON_CONTROLLED_SEAT_NOT_BOT });
  });

  it('lets the host act through a taken-over bot seat', () => {
    const state = nightState();
    const decision = decide(state, { type: 'avalon.night.confirm' }, HOST, 1, 'takeover-bot-seat');
    if (decision.kind === 'reject') {
      // Seat 1 may simply not participate in the current night step; the gate
      // itself must not be the rejection reason.
      expect(decision.reason).not.toBe(REASON_NOT_HOST);
      expect(decision.reason).not.toBe(REASON_CONTROLLED_SEAT_NOT_BOT);
      return;
    }
    expect(decision.kind).toBe('commit');
  });
});
