/** Avalon Worker effect execution: exactly-once growth settlement for game completion. */

import type { AvalonEffect } from '@game-judge/game-engine/games/avalon/public';
import { env } from 'cloudflare:test';
import { describe, expect, it, vi } from 'vitest';

import { avalonEffectSchema } from '../effects';
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
        xpEarned: 15,
        normalDrawsEarned: 3,
      }),
    );
    const readStats = () =>
      env.DB.prepare(
        "SELECT xp, normal_draws, games_played FROM user_stats WHERE user_id = 'avalon-host'",
      ).first();
    expect(await readStats()).toEqual({ xp: 15, normal_draws: 3, games_played: 1 });
    // A redelivered effect must not award twice.
    await avalonWorkerModule.handleEffect(effect, { ...context, deliveryAttemptCount: 2 });
    expect(await readStats()).toEqual({ xp: 15, normal_draws: 3, games_played: 1 });
    expect(context.dispatchInternal).not.toHaveBeenCalled();
  });
});
