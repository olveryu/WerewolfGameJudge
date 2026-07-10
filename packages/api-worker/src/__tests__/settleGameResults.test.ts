/** Game settlement — human threshold, registration, and idempotency contracts. */

import { buildInitialGameState } from '@werewolf/game-engine/engine/state/buildInitialState';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { RoleId } from '@werewolf/game-engine/models/roles/spec/specs';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import type { GameState, Player } from '@werewolf/game-engine/protocol/types';
import { env } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { settleGameResults } from '../growth/settleGameResults';
import { bootstrapTestSchema } from './testSchemaBootstrap';

const ROLES: readonly RoleId[] = ['wolf', 'seer', 'villager', 'villager', 'villager', 'villager'];
const TEMPLATE: GameTemplate = {
  name: 'Settlement contract',
  numberOfPlayers: ROLES.length,
  roles: [...ROLES],
};

function buildEndedState(
  roomCode: string,
  playerCount: number,
  botSeats: readonly number[] = [],
): GameState {
  const state = buildInitialGameState(roomCode, 'user-0', TEMPLATE);
  state.status = GameStatus.Ended;

  for (let seat = 0; seat < playerCount; seat += 1) {
    const role = ROLES[seat];
    if (!role) {
      throw new Error(`Missing settlement test role for seat ${seat}`);
    }
    const player: Player = {
      userId: `user-${seat}`,
      seat,
      role,
      hasViewedRole: true,
      isBot: botSeats.includes(seat),
    };
    state.players[seat] = player;
  }

  return state;
}

async function insertUser(userId: string, isAnonymous: boolean): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO users (id, display_name, is_anonymous, created_at, updated_at)
     VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
  )
    .bind(userId, userId, isAnonymous ? 1 : 0)
    .run();
}

beforeAll(async () => {
  await bootstrapTestSchema(env.DB);
});

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM camp_settlements').run();
  await env.DB.prepare('DELETE FROM user_stats').run();
  await env.DB.prepare('DELETE FROM room_participants').run();
  await env.DB.prepare('DELETE FROM rooms').run();
  await env.DB.prepare('DELETE FROM users').run();
});

describe('settleGameResults', () => {
  it('does not settle a game with fewer than six distinct human players', async () => {
    const state = buildEndedState('SETTLE-SHORT', 5);
    await insertUser('user-0', false);

    await expect(settleGameResults(state, env, 12)).resolves.toEqual([]);

    const stats = await env.DB.prepare('SELECT * FROM user_stats').all();
    expect(stats.results).toHaveLength(0);
  });

  it('counts anonymous humans toward the threshold but rewards registered users only', async () => {
    const state = buildEndedState('SETTLE-MIXED', 6);
    await insertUser('user-0', false);
    for (let seat = 1; seat < 6; seat += 1) {
      await insertUser(`user-${seat}`, true);
    }

    const results = await settleGameResults(state, env, 20);

    expect(results).toHaveLength(1);
    expect(results[0]?.userId).toBe('user-0');
    const stats = await env.DB.prepare(
      'SELECT games_played, last_room_code FROM user_stats WHERE user_id = ?',
    )
      .bind('user-0')
      .first<{ games_played: number; last_room_code: string }>();
    expect(stats).toEqual({ games_played: 1, last_room_code: 'SETTLE-MIXED:20' });
  });

  it('excludes bots from the human threshold', async () => {
    const state = buildEndedState('SETTLE-BOTS', 6, [5]);
    await insertUser('user-0', false);

    await expect(settleGameResults(state, env, 21)).resolves.toEqual([]);
  });

  it('settles the same room revision exactly once', async () => {
    const state = buildEndedState('SETTLE-ONCE', 6);
    await insertUser('user-0', false);

    const firstResults = await settleGameResults(state, env, 30);
    const secondResults = await settleGameResults(state, env, 30);

    expect(firstResults).toHaveLength(1);
    expect(secondResults).toEqual([]);
    const stats = await env.DB.prepare(
      'SELECT games_played, last_room_code FROM user_stats WHERE user_id = ?',
    )
      .bind('user-0')
      .first<{ games_played: number; last_room_code: string }>();
    expect(stats).toEqual({ games_played: 1, last_room_code: 'SETTLE-ONCE:30' });
    const settlements = await env.DB.prepare(
      'SELECT settle_key FROM camp_settlements WHERE user_id = ?',
    )
      .bind('user-0')
      .all<{ settle_key: string }>();
    expect(settlements.results).toEqual([{ settle_key: 'SETTLE-ONCE:30' }]);
  });
});
