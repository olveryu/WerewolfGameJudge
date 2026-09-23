/** Undercover Worker execution exercises real schemas, engine decisions and D1 allocation. */

import {
  type UndercoverPublicCommand,
  type UndercoverState,
} from '@game-judge/game-engine/games/undercover/public';
import { createRoomCommandResult } from '@game-judge/game-engine/platform/protocol/commandResult';
import { env } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';

import { undercoverWorkerModule } from '../module';

function applyCommand(state: UndercoverState, command: UndercoverPublicCommand, commandId: string) {
  const decision = undercoverWorkerModule.decidePublic(state, command, {
    actor: { kind: 'user', userId: 'host' },
    controlledSeat: null,
    nowMs: 1000,
    commandId,
    randomSeed: commandId,
  });
  if (decision.kind === 'reject') throw new Error(decision.reason);
  return decision;
}

function prepare() {
  const initial = undercoverWorkerModule.createInitialState(
    { numberOfPlayers: 4, hasBlank: false, category: 'all' },
    { roomCode: '8765', hostUserId: 'host', nowMs: 1, commandId: 'create' },
  );
  if (initial.kind !== 'created') throw new Error(initial.reason);
  const seated = applyCommand(
    initial.state,
    { type: 'room.seat.take', seat: 0, profile: { displayName: 'Host' } },
    'seat',
  );
  const full = applyCommand(seated.state, { type: 'room.seat.fillBots' }, 'fill');
  return applyCommand(
    full.state,
    { type: 'undercover.round.start', shouldAllowRepeated: false },
    'start',
  );
}

describe('Undercover Worker effects', () => {
  it('retries a completed round reward after returning to the lobby without awarding twice', async () => {
    await env.DB.prepare(
      `INSERT INTO users (id, display_name, is_anonymous, created_at, updated_at)
      VALUES ('host', 'Host', 0, datetime('now'), datetime('now'))`,
    ).run();
    const preparing = prepare();
    if (preparing.state.phase !== 'preparing') throw new Error('Expected preparing round');
    const roundId = preparing.state.pendingRound.roundId;
    const reading = undercoverWorkerModule.decideInternal(
      preparing.state,
      {
        type: 'undercover.round.complete',
        roundId,
        wordPair: { id: 'reward-pair', wordA: 'Milk', wordB: 'Soy milk', category: 'food' },
      },
      {
        actor: { kind: 'system', effectId: 'word-selection' },
        controlledSeat: null,
        nowMs: 1000,
        commandId: 'complete',
        randomSeed: 'reward-seed',
      },
    );
    if (reading.kind === 'reject') throw new Error(reading.reason);
    const confirmed = applyCommand(
      reading.state,
      { type: 'undercover.round.confirm', roundId },
      'confirm',
    );
    let decision = applyCommand(
      confirmed.state,
      { type: 'undercover.round.markAllBotsViewed', roundId },
      'bots',
    );
    for (let seat = 0; decision.state.phase === 'ongoing'; seat += 1) {
      decision = applyCommand(
        decision.state,
        { type: 'undercover.round.reveal', roundId, seat },
        `reveal-${seat}`,
      );
    }
    expect(decision.state.phase).toBe('ended');
    const effect = decision.effects[0];
    if (effect === undefined) throw new Error('Missing completion effect');
    expect(effect).toMatchObject({
      type: 'undercover.game.completed',
      payload: { participantUserIds: ['host'] },
    });
    expect(undercoverWorkerModule.canReplayFailedEffect(effect)).toBe(true);
    expect(undercoverWorkerModule.getEffectFailureCommand(effect, preparing.state)).toBeNull();
    const lobby = applyCommand(decision.state, { type: 'undercover.game.returnToLobby' }, 'lobby');
    const publishUserEvent = vi
      .fn()
      .mockRejectedValueOnce(new Error('inbox unavailable'))
      .mockResolvedValue(undefined);
    const context = {
      bindings: env,
      effectId: 'completion',
      state: lobby.state,
      roomIdentity: { roomId: 'reward-room', roomCode: '8765', creationId: 'reward-creation' },
      createdRevision: 10,
      deliveryAttemptCount: 1,
      publishUserEvent,
      dispatchInternal: vi.fn(() => {
        throw new Error('Rewards must not dispatch a game command');
      }),
    };
    await expect(undercoverWorkerModule.handleEffect(effect, context)).rejects.toThrow(
      'inbox unavailable',
    );
    await undercoverWorkerModule.handleEffect(effect, { ...context, deliveryAttemptCount: 2 });
    expect(publishUserEvent.mock.calls[1]).toEqual(publishUserEvent.mock.calls[0]);
    expect(publishUserEvent).toHaveBeenCalledWith(
      'host',
      expect.any(String),
      expect.objectContaining({
        type: 'SETTLE_RESULT',
        gameType: 'undercover',
        xpEarned: 5,
        normalDrawsEarned: 1,
      }),
    );
    expect(
      await env.DB.prepare(
        "SELECT xp, normal_draws, games_played FROM user_stats WHERE user_id = 'host'",
      ).first(),
    ).toEqual({ xp: 5, normal_draws: 1, games_played: 1 });
    expect(context.dispatchInternal).not.toHaveBeenCalled();
  });

  it('commits exhaustion, retries the same round and delivers a persisted pair through the internal engine', async () => {
    await env.DB.prepare("DELETE FROM rooms WHERE id = 'effect-room'").run();
    await env.DB.prepare('DELETE FROM undercover_word_pairs').run();
    await env.DB.prepare(
      `INSERT INTO rooms (id, code, game_type, host_user_id, creation_id, config_json, status, created_at, updated_at)
      VALUES ('effect-room', '8765', 'undercover', 'host', 'effect-creation', '{}', 'active', '2026-09-21', '2026-09-21')`,
    ).run();
    const preparing = prepare();
    const effect = preparing.effects[0];
    if (effect === undefined) throw new Error('Missing selection effect');
    expect(undercoverWorkerModule.canReplayFailedEffect(effect)).toBe(false);
    let state = preparing.state;
    const context = (effectId: string) => ({
      bindings: env,
      effectId,
      state,
      roomIdentity: { roomId: 'effect-room', roomCode: '8765', creationId: 'effect-creation' },
      createdRevision: 3,
      deliveryAttemptCount: 1,
      publishUserEvent: () => Promise.resolve(),
      dispatchInternal: (commandId: string, command: unknown) => {
        const decision = undercoverWorkerModule.decideInternal(state, command, {
          actor: { kind: 'system', effectId },
          controlledSeat: null,
          commandId,
          nowMs: 2000,
          randomSeed: 'effect-seed',
        });
        if (decision.kind === 'reject') throw new Error(decision.reason);
        state = decision.state;
        return Promise.resolve(
          createRoomCommandResult({
            kind: 'committed',
            commandId,
            state,
            revision: 4,
            outcome: decision.outcome,
          }),
        );
      },
    });
    await undercoverWorkerModule.handleEffect(effect, context('first-attempt'));
    expect(state).toMatchObject({ phase: 'preparationFailed', failureCode: 'inventoryEmpty' });
    expect(undercoverWorkerModule.parseState(JSON.parse(JSON.stringify(state)))).toEqual(state);
    state = applyCommand(
      state,
      { type: 'undercover.round.retry', roundId: effect.payload.roundId },
      'retry',
    ).state;
    expect(undercoverWorkerModule.getEffectFailureCommand(effect, state)).toMatchObject({
      failureCode: 'selectionFailed',
    });
    await env.DB.prepare(
      `INSERT INTO undercover_word_pairs VALUES ('effect-pair', 'Milk', 'Soy milk', 'food', 'active', '2026-09-21', '2026-09-21', '{}')`,
    ).run();
    await undercoverWorkerModule.handleEffect(effect, context('retry-attempt'));
    expect(state).toMatchObject({
      phase: 'reading',
      round: { roundId: effect.payload.roundId, wordPair: { id: 'effect-pair' } },
    });
    expect(undercoverWorkerModule.parseState(JSON.parse(JSON.stringify(state)))).toEqual(state);
    expect(undercoverWorkerModule.getEffectFailureCommand(effect, state)).toBeNull();
    await undercoverWorkerModule.handleEffect(effect, context('stale-attempt'));
    expect(state.phase).toBe('reading');
  });
});
