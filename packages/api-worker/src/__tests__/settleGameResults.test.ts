/** Game settlement ledger, deterministic rewards, and outbox retry contracts. */

import { buildInitialGameState } from '@werewolf/game-engine/engine/state/buildInitialState';
import type {
  WerewolfGameEndedEffect,
  WerewolfInternalCommand,
} from '@werewolf/game-engine/games/werewolf/public';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { RoomCommandResult } from '@werewolf/game-engine/platform/protocol/commandResult';
import { createRoomSnapshot } from '@werewolf/game-engine/platform/protocol/roomSnapshot';
import type { GameState } from '@werewolf/game-engine/protocol/types';
import { env } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { handleWerewolfEffect, werewolfEffectSchema } from '../games/werewolf/effects';
import type { WorkerEffectContext } from '../games/workerModule';
import { settleGameResults } from '../growth/settleGameResults';
import { bootstrapTestSchema } from './testSchemaBootstrap';

const ROLES: readonly RoleId[] = ['wolf', 'seer', 'villager', 'villager', 'villager', 'villager'];

function buildEndedEffect(
  roomCode: string,
  playerCount = ROLES.length,
  botSeats: readonly number[] = [],
): WerewolfGameEndedEffect {
  return {
    type: 'werewolf.game.ended',
    payload: {
      roomCode,
      participants: Array.from({ length: playerCount }, (_, seat) => {
        const role = ROLES[seat];
        if (role === undefined) {
          throw new Error(`Missing settlement test role for seat ${seat}`);
        }
        return {
          userId: `user-${seat}`,
          role,
          isBot: botSeats.includes(seat),
        };
      }),
    },
  };
}

async function insertUser(userId: string, isAnonymous: boolean): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO users (id, display_name, is_anonymous, created_at, updated_at)
     VALUES (?1, ?2, ?3, datetime('now'), datetime('now'))`,
  )
    .bind(userId, userId, isAnonymous ? 1 : 0)
    .run();
}

async function insertEffectUsers(registeredUserIds: readonly string[]): Promise<void> {
  const registered = new Set(registeredUserIds);
  for (let seat = 0; seat < ROLES.length; seat += 1) {
    const userId = `user-${seat}`;
    await insertUser(userId, !registered.has(userId));
  }
}

async function readStats(userId: string): Promise<{
  xp: number;
  level: number;
  games_played: number;
  normal_draws: number;
  golden_draws: number;
}> {
  const row = await env.DB.prepare(
    `SELECT xp, level, games_played, normal_draws, golden_draws
     FROM user_stats
     WHERE user_id = ?1`,
  )
    .bind(userId)
    .first<{
      xp: number;
      level: number;
      games_played: number;
      normal_draws: number;
      golden_draws: number;
    }>();
  if (row === null) throw new Error(`Missing stats for ${userId}`);
  return row;
}

function buildSnapshot(): ReturnType<typeof createRoomSnapshot<GameState>> {
  const state = buildInitialGameState('EFFECT-ROOM', 'user-0', {
    name: 'Settlement effect test',
    numberOfPlayers: ROLES.length,
    roles: [...ROLES],
  });
  return createRoomSnapshot(state, 1);
}

beforeAll(async () => {
  await bootstrapTestSchema(env.DB);
});

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM game_settlement_results').run();
  await env.DB.prepare('DELETE FROM camp_settlements').run();
  await env.DB.prepare('DELETE FROM user_stats').run();
  await env.DB.prepare('DELETE FROM room_participants').run();
  await env.DB.prepare('DELETE FROM rooms').run();
  await env.DB.prepare('DELETE FROM users').run();
});

describe('settleGameResults', () => {
  it('atomically settles every registered human and records exact outcomes', async () => {
    const effect = buildEndedEffect('SETTLE-SUCCESS');
    await insertEffectUsers(['user-0', 'user-1']);

    const results = await settleGameResults('effect-success', effect, env);

    expect(results).toHaveLength(2);
    for (const result of results) {
      const stats = await readStats(result.userId);
      expect(stats).toEqual({
        xp: result.newXp,
        level: result.newLevel,
        games_played: 1,
        normal_draws: result.normalDrawsEarned,
        golden_draws: result.goldenDrawsEarned,
      });
    }
    const rows = await env.DB.prepare(
      `SELECT effect_id, stats_applied
       FROM game_settlement_results
       ORDER BY user_id`,
    ).all<{ effect_id: string; stats_applied: number }>();
    expect(rows.results).toEqual([
      { effect_id: 'effect-success', stats_applied: 1 },
      { effect_id: 'effect-success', stats_applied: 1 },
    ]);
  });

  it('does not settle a game with fewer than six distinct human players', async () => {
    const effect = buildEndedEffect('SETTLE-SHORT', 5);
    await insertUser('user-0', false);

    await expect(settleGameResults('effect-short', effect, env)).resolves.toEqual([]);

    const stats = await env.DB.prepare('SELECT user_id FROM user_stats').all();
    const results = await env.DB.prepare('SELECT effect_id FROM game_settlement_results').all();
    expect(stats.results).toHaveLength(0);
    expect(results.results).toHaveLength(0);
  });

  it('counts anonymous humans toward eligibility but rewards registered users only', async () => {
    const effect = buildEndedEffect('SETTLE-MIXED');
    await insertEffectUsers(['user-0']);

    const results = await settleGameResults('effect-mixed', effect, env);

    expect(results).toHaveLength(1);
    expect(results[0]?.userId).toBe('user-0');
    expect((await readStats('user-0')).games_played).toBe(1);
  });

  it('excludes bots from the human threshold', async () => {
    const effect = buildEndedEffect('SETTLE-BOTS', 6, [5]);
    await insertEffectUsers(['user-0']);

    await expect(settleGameResults('effect-bots', effect, env)).resolves.toEqual([]);
  });

  it('returns the exact committed results on replay without awarding twice', async () => {
    const effect = buildEndedEffect('SETTLE-REPLAY');
    await insertEffectUsers(['user-0']);

    const firstResults = await settleGameResults('effect-replay', effect, env);
    const replayResults = await settleGameResults('effect-replay', effect, env);

    expect(replayResults).toEqual(firstResults);
    expect((await readStats('user-0')).games_played).toBe(1);
    const settlements = await env.DB.prepare(
      `SELECT settle_key
       FROM camp_settlements
       WHERE user_id = ?1`,
    )
      .bind('user-0')
      .all<{ settle_key: string }>();
    expect(settlements.results).toEqual([{ settle_key: 'effect-replay' }]);
  });

  it('reproduces rewards from effectId and userId after rebuilding persistence', async () => {
    const effect = buildEndedEffect('SETTLE-DETERMINISTIC');
    await insertEffectUsers(['user-0']);
    const firstResults = await settleGameResults('effect-deterministic', effect, env);

    await env.DB.prepare('DELETE FROM game_settlement_results').run();
    await env.DB.prepare('DELETE FROM camp_settlements').run();
    await env.DB.prepare('DELETE FROM user_stats').run();
    const rebuiltResults = await settleGameResults('effect-deterministic', effect, env);

    expect(rebuiltResults).toEqual(firstResults);
  });

  it('fails fast instead of replaying a malformed persisted result', async () => {
    const effect = buildEndedEffect('SETTLE-MALFORMED');
    await insertEffectUsers(['user-0']);
    await settleGameResults('effect-malformed', effect, env);
    await env.DB.prepare(
      `UPDATE game_settlement_results
       SET participant_fingerprint = 'corrupt'
       WHERE effect_id = ?1`,
    )
      .bind('effect-malformed')
      .run();

    await expect(settleGameResults('effect-malformed', effect, env)).rejects.toThrow(
      'does not match its game effect',
    );
  });

  it('serializes concurrent effects against the stats row each one observed', async () => {
    const effect = buildEndedEffect('SETTLE-CONCURRENT');
    await insertEffectUsers(['user-0']);

    const [[left], [right]] = await Promise.all([
      settleGameResults('effect-concurrent-left', effect, env),
      settleGameResults('effect-concurrent-right', effect, env),
    ]);
    if (left === undefined || right === undefined) {
      throw new Error('Concurrent settlement did not return both registered-player results');
    }

    const ordered = [left, right].sort((a, b) => a.newXp - b.newXp);
    expect(ordered[0]?.previousLevel).toBe(0);
    expect(ordered[1]?.newXp).toBe((await readStats('user-0')).xp);
    expect((await readStats('user-0')).games_played).toBe(2);
    const ledgerRows = await env.DB.prepare(
      `SELECT previous_xp, new_xp
       FROM game_settlement_results
       WHERE user_id = ?1
       ORDER BY previous_xp`,
    )
      .bind('user-0')
      .all<{ previous_xp: number; new_xp: number }>();
    expect(ledgerRows.results[1]?.previous_xp).toBe(ledgerRows.results[0]?.new_xp);
  });

  it('fails fast when the effect repeats a participant identity', async () => {
    const effect = buildEndedEffect('SETTLE-DUPLICATE');
    const firstParticipant = effect.payload.participants[0];
    if (firstParticipant === undefined) throw new Error('Missing test participant');
    const malformed: WerewolfGameEndedEffect = {
      ...effect,
      payload: {
        ...effect.payload,
        participants: [...effect.payload.participants, firstParticipant],
      },
    };

    await expect(settleGameResults('effect-duplicate', malformed, env)).rejects.toThrow(
      'duplicate participant',
    );
  });
});

describe('Werewolf game-ended effect handler', () => {
  it('rejects malformed effects before settlement', () => {
    expect(() =>
      werewolfEffectSchema.parse({
        type: 'werewolf.game.ended',
        payload: {
          roomCode: 'SCHEMA',
          participants: [{ userId: 'user-0', isBot: false }],
        },
      }),
    ).toThrow();
  });

  it('retries exact D1 results until the internal command commits successfully', async () => {
    const effect = buildEndedEffect('EFFECT-ROOM');
    await insertEffectUsers(['user-0']);
    const dispatchCalls: { commandId: string; command: WerewolfInternalCommand }[] = [];
    const sentMessages: { userId: string; message: object }[] = [];
    let dispatchOutcome: 'transportRejected' | 'domainRejected' | 'success' = 'transportRejected';
    const snapshot = buildSnapshot();

    const context: WorkerEffectContext<WerewolfInternalCommand> = {
      bindings: env,
      effectId: 'effect-handler-retry',
      roomCode: 'EFFECT-ROOM',
      revision: 12,
      dispatchInternal: async (commandId, command): Promise<RoomCommandResult<GameState>> => {
        dispatchCalls.push({ commandId, command });
        if (dispatchOutcome === 'transportRejected') {
          return { kind: 'rejected', commandId, reason: 'temporary_rejection' };
        }
        if (dispatchOutcome === 'domainRejected') {
          return {
            kind: 'committed',
            commandId,
            snapshot,
            outcome: { kind: 'domainRejected', reason: 'roster_rejected' },
          };
        }
        return {
          kind: 'committed',
          commandId,
          snapshot,
          outcome: { kind: 'success' },
        };
      },
      sendToUser: (userId, message) => {
        sentMessages.push({ userId, message });
      },
    };

    await expect(handleWerewolfEffect(effect, context)).rejects.toThrow('was rejected');
    expect(sentMessages).toEqual([]);
    expect((await readStats('user-0')).games_played).toBe(1);

    dispatchOutcome = 'domainRejected';
    await expect(handleWerewolfEffect(effect, context)).rejects.toThrow('failed');
    expect(sentMessages).toEqual([]);
    expect((await readStats('user-0')).games_played).toBe(1);

    dispatchOutcome = 'success';
    await handleWerewolfEffect(effect, context);

    expect((await readStats('user-0')).games_played).toBe(1);
    expect(dispatchCalls).toHaveLength(3);
    expect(new Set(dispatchCalls.map((call) => call.commandId)).size).toBe(1);
    const firstDispatch = dispatchCalls[0];
    if (firstDispatch === undefined) throw new Error('Missing internal dispatch');
    expect(firstDispatch.command.type).toBe('werewolf.growth.applyRosterLevels');
    expect(typeof firstDispatch.command.levels['user-0']).toBe('number');
    for (const call of dispatchCalls) {
      expect(call.command).toEqual(firstDispatch.command);
    }

    expect(sentMessages).toHaveLength(1);
    const sentMessage = sentMessages[0];
    if (sentMessage === undefined) throw new Error('Missing settlement message');
    expect(sentMessage.userId).toBe('user-0');
    expect(sentMessage.message).toMatchObject({
      type: 'SETTLE_RESULT',
      gameType: 'werewolf',
      settlementId: 'effect-handler-retry',
      endedRevision: 12,
    });
  });
});
