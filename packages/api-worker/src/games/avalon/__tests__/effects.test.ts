/** Avalon Worker effect execution: exactly-once growth settlement for game completion. */

import {
  AVALON_REASONS,
  type AvalonEffect,
  type AvalonInternalCommand,
  type AvalonPublicCommand,
  type AvalonState,
  getAvalonNightParticipants,
} from '@game-judge/game-engine/games/avalon/public';
import { createRoomCommandResult } from '@game-judge/game-engine/platform/protocol/commandResult';
import { env } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';

import type { WorkerEffectContext } from '../../../platform/gameModules/workerModule';
import { avalonEffectSchema, handleAvalonEffect } from '../effects';
import { avalonWorkerModule } from '../module';

const ROUND_ID = 'avalon:game:1';

function completedEffect(participantUserIds: readonly string[]): AvalonEffect {
  return avalonEffectSchema.parse({
    type: 'avalon.game.completed',
    payload: { roundId: ROUND_ID, completedAt: 1000, participantUserIds: [...participantUserIds] },
  });
}

function effectContext() {
  const created = avalonWorkerModule.createInitialState(
    { numberOfPlayers: 5, voteMode: 'public', vetoLimit: 5 },
    { roomCode: '1234', hostUserId: 'avalon-host', nowMs: 1, commandId: 'create' },
  );
  if (created.kind !== 'created') throw new Error(created.reason);
  return {
    bindings: env,
    effectId: 'completion-effect',
    state: created.state,
    roomIdentity: { roomId: 'avalon-room', roomCode: '1234', creationId: 'avalon-creation' },
    createdRevision: 10,
    deliveryAttemptCount: 1,
    publishUserEvent: vi.fn(async () => undefined),
    dispatchInternal: vi.fn(() => {
      throw new Error('Rewards must not dispatch a game command');
    }),
  };
}

describe('Avalon completion effect', () => {
  it('validates the settlement payload strictly', () => {
    expect(
      avalonEffectSchema.safeParse({
        type: 'avalon.game.completed',
        payload: { roundId: ROUND_ID, completedAt: 1000, participantUserIds: ['u1'], extra: 1 },
      }).success,
    ).toBe(false);
    expect(
      avalonEffectSchema.safeParse({ type: 'avalon.game.completed', payload: {} }).success,
    ).toBe(false);
  });

  it('uses a stable business key and replays without a failure command', () => {
    const effect = completedEffect(['avalon-host']);
    const businessContext = { originCommandId: 'create', createdRevision: 10 };
    expect(avalonWorkerModule.getEffectBusinessKey(effect, businessContext)).toBe(ROUND_ID);
    expect(avalonWorkerModule.getEffectBusinessKey(effect, businessContext)).toBe(
      avalonWorkerModule.getEffectBusinessKey(effect, businessContext),
    );
    expect(avalonWorkerModule.canReplayFailedEffect(effect)).toBe(true);
    expect(avalonWorkerModule.getEffectFailureCommand(effect, effectContext().state)).toBeNull();
  });

  it('settles growth rewards exactly once across redeliveries', async () => {
    await env.DB.prepare(
      `INSERT INTO users (id, display_name, is_anonymous, created_at, updated_at)
       VALUES ('avalon-host', 'Host', 0, datetime('now'), datetime('now'))`,
    ).run();
    const effect = completedEffect(['avalon-host']);
    const context = effectContext();
    await avalonWorkerModule.handleEffect(effect, context);
    expect(context.publishUserEvent).toHaveBeenCalledWith(
      'avalon-host',
      expect.any(String),
      expect.objectContaining({
        type: 'SETTLE_RESULT',
        gameType: 'avalon',
        xpEarned: 33,
        normalDrawsEarned: 3,
      }),
    );
    const readStats = () =>
      env.DB.prepare(
        "SELECT xp, normal_draws, games_played FROM user_stats WHERE user_id = 'avalon-host'",
      ).first();
    expect(await readStats()).toEqual({ xp: 33, normal_draws: 3, games_played: 1 });
    // A redelivered effect must not award twice.
    await avalonWorkerModule.handleEffect(effect, { ...context, deliveryAttemptCount: 2 });
    expect(await readStats()).toEqual({ xp: 33, normal_draws: 3, games_played: 1 });
    expect(context.dispatchInternal).not.toHaveBeenCalled();
  });
});

const SETTLE_HOST = 'avalon-host';
const seatUser = (seat: number) => (seat === 0 ? SETTLE_HOST : `u${seat}`);

function applyPublic(
  state: AvalonState,
  command: AvalonPublicCommand,
  userId: string,
  commandId: string,
  nowMs = 1000,
): AvalonState {
  const decision = avalonWorkerModule.decidePublic(state, command, {
    actor: { kind: 'user', userId },
    controlledSeat: null,
    nowMs,
    commandId,
    randomSeed: commandId,
  });
  if (decision.kind !== 'commit') throw new Error(`Expected commit: ${decision.reason}`);
  return decision.state;
}

/** Five seated humans driven to an armed vote countdown (deadline 6000). */
function armedVoteState(): AvalonState {
  const created = avalonWorkerModule.createInitialState(
    { numberOfPlayers: 5, voteMode: 'public', vetoLimit: 5 },
    { roomCode: '1234', hostUserId: SETTLE_HOST, nowMs: 1, commandId: 'create' },
  );
  if (created.kind !== 'created') throw new Error(created.reason);
  let state = created.state;
  for (let seat = 0; seat < 5; seat += 1) {
    state = applyPublic(
      state,
      { type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } },
      seatUser(seat),
      `seat-${seat}`,
    );
  }
  state = applyPublic(state, { type: 'avalon.game.start' }, SETTLE_HOST, 'start');
  for (let seat = 0; seat < 5; seat += 1) {
    state = applyPublic(state, { type: 'avalon.role.viewed' }, seatUser(seat), `view-${seat}`);
  }
  state = applyPublic(state, { type: 'avalon.game.begin' }, SETTLE_HOST, 'begin');
  const ackAudio = (current: AvalonState): AvalonState => {
    let next = current;
    while (next.isAudioPlaying) {
      next = applyPublic(
        next,
        { type: 'avalon.audio.ack' },
        SETTLE_HOST,
        `ack-${next.pendingAudioEffects.length}`,
      );
    }
    return next;
  };
  state = ackAudio(state);
  // Every participant of each night step confirms (engine passNight).
  while (state.phase.kind === 'night') {
    const participants = getAvalonNightParticipants(state.roles, state.phase.step);
    for (const seat of participants) {
      state = applyPublic(
        state,
        { type: 'avalon.night.confirm' },
        seatUser(seat),
        `night-${state.phase.step}-${seat}`,
      );
    }
    state = ackAudio(state);
  }
  const leader = state.leaderSeat;
  state = applyPublic(
    state,
    { type: 'avalon.team.propose', seats: [0, 1] },
    seatUser(leader),
    'propose',
  );
  for (let seat = 0; seat < 5; seat += 1) {
    state = applyPublic(
      state,
      { type: 'avalon.team.vote', vote: 'approve' },
      seatUser(seat),
      `vote-${seat}`,
    );
  }
  if (state.phase.kind !== 'vote' || state.phase.deadlineAt !== 6000) {
    throw new Error('Expected an armed vote countdown with deadline 6000');
  }
  return state;
}

function settleEffectFor(
  state: AvalonState,
  overrides: Partial<Extract<AvalonEffect, { type: 'avalon.settle.due' }>['payload']> = {},
): AvalonEffect {
  if (state.phase.kind !== 'vote' && state.phase.kind !== 'quest') {
    throw new Error('Expected a vote or quest phase');
  }
  return avalonEffectSchema.parse({
    type: 'avalon.settle.due',
    payload: {
      gameSequence: state.gameSequence,
      phase: state.phase.kind,
      round: state.phase.round,
      deadlineAt: state.phase.deadlineAt,
      ...overrides,
    },
  });
}

/**
 * Effect context whose dispatchInternal runs the real engine internal
 * decide, so a settle delivery settles (or rejects) for real.
 */
function settleContext(state: AvalonState, nowMs = 6000) {
  const box: { current: AvalonState; commands: AvalonInternalCommand[] } = {
    current: state,
    commands: [],
  };
  const context: WorkerEffectContext<AvalonState, AvalonInternalCommand> = {
    bindings: env,
    effectId: 'settle-effect',
    state,
    roomIdentity: { roomId: 'avalon-room', roomCode: '1234', creationId: 'avalon-creation' },
    createdRevision: 10,
    deliveryAttemptCount: 1,
    publishUserEvent: vi.fn(async () => undefined),
    dispatchInternal: (commandId, command) => {
      box.commands.push(command);
      const decision = avalonWorkerModule.decideInternal(box.current, command, {
        actor: { kind: 'system', effectId: 'settle-effect' },
        controlledSeat: null,
        nowMs,
        commandId,
        randomSeed: commandId,
      });
      if (decision.kind === 'reject') {
        return Promise.resolve({ kind: 'rejected', commandId, reason: decision.reason });
      }
      box.current = decision.state;
      return Promise.resolve(
        createRoomCommandResult({
          kind: 'committed',
          commandId,
          state: decision.state,
          revision: 11,
          outcome: { kind: 'success' },
        }),
      );
    },
  };
  return { context, box };
}

describe('Avalon settle effect', () => {
  it('validates the settle payload strictly', () => {
    const state = armedVoteState();
    expect(settleEffectFor(state).type).toBe('avalon.settle.due');
    expect(
      avalonEffectSchema.safeParse({
        type: 'avalon.settle.due',
        payload: { gameSequence: 1, phase: 'vote', round: 6, deadlineAt: 6000 },
      }).success,
    ).toBe(false);
    expect(
      avalonEffectSchema.safeParse({
        type: 'avalon.settle.due',
        payload: { gameSequence: 1, phase: 'vote', round: 1, deadlineAt: 6000, extra: 1 },
      }).success,
    ).toBe(false);
  });

  it('keys settle effects by arming identity and delivers them at the deadline', () => {
    const state = armedVoteState();
    const effect = settleEffectFor(state);
    const businessContext = { originCommandId: 'vote-4', createdRevision: 10 };
    expect(avalonWorkerModule.getEffectBusinessKey(effect, businessContext)).toBe(
      `avalon:settle:${state.gameSequence}:vote:1:6000`,
    );
    expect(avalonWorkerModule.getEffectDeliveryAt?.(effect, businessContext)).toBe(6000);
    const completion = completedEffect(['avalon-host']);
    expect(avalonWorkerModule.getEffectDeliveryAt?.(completion, businessContext)).toBeNull();
  });

  it('settles the armed vote through the internal system command', async () => {
    const state = armedVoteState();
    const { context, box } = settleContext(state);
    await handleAvalonEffect(settleEffectFor(state), context);
    expect(box.commands).toEqual([{ type: 'avalon.phase.settleExpired' }]);
    expect(box.current.phase.kind).toBe('quest');
    expect(box.current.lastVoteResult?.approveCount).toBe(5);
  });

  it('settles the armed quest through the internal system command', async () => {
    let state = armedVoteState();
    const voteSettle = settleContext(state);
    await handleAvalonEffect(settleEffectFor(state), voteSettle.context);
    state = voteSettle.box.current;
    state = applyPublic(
      state,
      { type: 'avalon.quest.play', play: 'success' },
      seatUser(0),
      'play-0',
    );
    state = applyPublic(
      state,
      { type: 'avalon.quest.play', play: 'success' },
      seatUser(1),
      'play-1',
    );
    if (state.phase.kind !== 'quest' || state.phase.deadlineAt !== 6000) {
      throw new Error('Expected an armed quest countdown with deadline 6000');
    }
    const { context, box } = settleContext(state);
    await handleAvalonEffect(settleEffectFor(state), context);
    expect(box.commands).toEqual([{ type: 'avalon.phase.settleExpired' }]);
    expect(box.current.phase.kind).toBe('nominate');
    expect(box.current.questResults[0]).toBe('success');
  });

  it('no-ops deliveries whose pinned arming no longer matches the room', async () => {
    const state = armedVoteState();
    const stalePayloads = [
      { gameSequence: state.gameSequence + 1 },
      { phase: 'quest' as const },
      { round: 2 as const },
      { deadlineAt: 6001 },
    ];
    for (const overrides of stalePayloads) {
      const { context, box } = settleContext(state);
      await handleAvalonEffect(settleEffectFor(state, overrides), context);
      expect(box.commands).toEqual([]);
      expect(box.current).toBe(state);
    }
  });

  it('treats a superseded settle rejection as delivered, other rejections as failures', async () => {
    const state = armedVoteState();
    const effect = settleEffectFor(state);
    const base = settleContext(state).context;
    const rejectedWith = (reason: string) => ({
      ...base,
      dispatchInternal: (commandId: string) =>
        Promise.resolve({ kind: 'rejected' as const, commandId, reason }),
    });
    await expect(
      handleAvalonEffect(effect, rejectedWith(AVALON_REASONS.phase)),
    ).resolves.toBeUndefined();
    await expect(
      handleAvalonEffect(effect, rejectedWith(AVALON_REASONS.deadline)),
    ).resolves.toBeUndefined();
    await expect(handleAvalonEffect(effect, rejectedWith('avalon_not_host'))).rejects.toThrow(
      'was rejected: avalon_not_host',
    );
  });
});
