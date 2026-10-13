/** DrawGuess Worker effect execution: literal lock (AU-38) + exactly-once settlement. */

import {
  DEFAULT_DRAWGUESS_CONFIG,
  type DrawGuessEffect,
} from '@game-judge/game-engine/games/drawguess/public';
import { env } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';

import { drawGuessEffectSchema } from '../effects';
import { drawGuessWorkerModule } from '../module';

const ROUND_ID = 'drawguess:round:1';

function completedEffect(participantUserIds: readonly string[]): DrawGuessEffect {
  return drawGuessEffectSchema.parse({
    type: 'drawguess.game.completed',
    payload: { roundId: ROUND_ID, completedAt: 1000, participantUserIds: [...participantUserIds] },
  });
}

function effectContext() {
  const created = drawGuessWorkerModule.createInitialState(DEFAULT_DRAWGUESS_CONFIG, {
    roomCode: '1234',
    hostUserId: 'drawguess-host',
    nowMs: 1,
    commandId: 'create',
  });
  if (created.kind !== 'created') throw new Error(created.reason);
  return {
    bindings: env,
    effectId: 'completion-effect',
    state: created.state,
    roomIdentity: { roomId: 'drawguess-room', roomCode: '1234', creationId: 'drawguess-creation' },
    createdRevision: 10,
    deliveryAttemptCount: 1,
    publishUserEvent: vi.fn(async () => undefined),
    dispatchInternal: vi.fn(() => {
      throw new Error('Rewards must not dispatch a game command');
    }),
  };
}

describe('DrawGuess effects', () => {
  it('locks the effect type literals and validates payloads strictly', () => {
    expect(
      drawGuessEffectSchema.safeParse({
        type: 'drawguess.words.deal',
        payload: { turnIndex: 0 },
      }).success,
    ).toBe(true);
    expect(
      drawGuessEffectSchema.safeParse({
        type: 'drawguess.game.completed',
        payload: {
          roundId: ROUND_ID,
          completedAt: 1000,
          participantUserIds: ['u1'],
          extra: 1,
        },
      }).success,
    ).toBe(false);
    expect(
      drawGuessEffectSchema.safeParse({ type: 'drawguess.game.completed', payload: {} }).success,
    ).toBe(false);
    expect(
      drawGuessEffectSchema.safeParse({ type: 'drawguess.words.deal', payload: {} }).success,
    ).toBe(false);
  });

  it('derives stable business keys and replays without a failure command', () => {
    const businessContext = { originCommandId: 'create', createdRevision: 10 };
    const completed = completedEffect(['drawguess-host']);
    expect(drawGuessWorkerModule.getEffectBusinessKey(completed, businessContext)).toBe(
      `drawguess:game-completed:10:${ROUND_ID}`,
    );
    const deal = drawGuessEffectSchema.parse({
      type: 'drawguess.words.deal',
      payload: { turnIndex: 2 },
    });
    expect(drawGuessWorkerModule.getEffectBusinessKey(deal, businessContext)).toBe(
      'drawguess:words-deal:10:2',
    );
    expect(drawGuessWorkerModule.canReplayFailedEffect(completed)).toBe(true);
    expect(
      drawGuessWorkerModule.getEffectFailureCommand(completed, effectContext().state),
    ).toBeNull();
  });

  it('settles growth rewards exactly once across redeliveries', async () => {
    await env.DB.prepare(
      `INSERT INTO users (id, display_name, is_anonymous, created_at, updated_at)
       VALUES ('drawguess-host', 'Host', 0, datetime('now'), datetime('now'))`,
    ).run();
    const effect = completedEffect(['drawguess-host']);
    const context = effectContext();
    await drawGuessWorkerModule.handleEffect(effect, context);
    expect(context.publishUserEvent).toHaveBeenCalledWith(
      'drawguess-host',
      expect.any(String),
      expect.objectContaining({
        type: 'SETTLE_RESULT',
        gameType: 'drawguess',
        xpEarned: 15,
        normalDrawsEarned: 3,
      }),
    );
    const readStats = () =>
      env.DB.prepare(
        "SELECT xp, normal_draws, games_played FROM user_stats WHERE user_id = 'drawguess-host'",
      ).first();
    expect(await readStats()).toEqual({ xp: 15, normal_draws: 3, games_played: 1 });
    await drawGuessWorkerModule.handleEffect(effect, { ...context, deliveryAttemptCount: 2 });
    expect(await readStats()).toEqual({ xp: 15, normal_draws: 3, games_played: 1 });
    // The event is republished on redelivery with the same deterministic
    // eventId; the user-event inbox dedupes on (user_id, event_id), so the
    // user still receives it exactly once.
    const eventIds = context.publishUserEvent.mock.calls.map((call) => call[1]);
    expect(eventIds).toHaveLength(2);
    expect(eventIds[0]).toBe(eventIds[1]);
    expect(context.dispatchInternal).not.toHaveBeenCalled();
  });
});
