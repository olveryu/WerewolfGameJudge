/** Platform room effect derivation and D1 idempotency contracts. */

import { env } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import {
  derivePlatformRoomEffects,
  handlePlatformRoomEffect,
} from '../platform/room/platformEffects';
import { bootstrapTestSchema } from './testSchemaBootstrap';

const ROOM_CODE = 'PLATFORM-EFFECT';

beforeAll(async () => {
  await bootstrapTestSchema(env.DB);
});

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM room_game_starts').run();
  await env.DB.prepare('DELETE FROM room_participants').run();
  await env.DB.prepare('DELETE FROM rooms').run();
  await env.DB.prepare(
    `INSERT INTO rooms (
      id, code, host_user_id, created_at, updated_at, games_started
    ) VALUES ('room-id', ?, 'host-1', '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z', 0)`,
  )
    .bind(ROOM_CODE)
    .run();
});

describe('platform room effects', () => {
  it('derives participant and setup-to-ongoing effects only from successful outcomes', () => {
    expect(
      derivePlatformRoomEffects({
        roomCode: ROOM_CODE,
        actorUserId: 'host-1',
        commandType: 'room.seat.take',
        outcomeKind: 'success',
        previousLifecycle: 'setup',
        lifecycle: 'setup',
        committedRevision: 2,
        nowMs: 1_000,
      }),
    ).toEqual([
      {
        type: 'platform.room.participantJoined',
        roomCode: ROOM_CODE,
        userId: 'host-1',
        joinedAtMs: 1_000,
      },
    ]);
    expect(
      derivePlatformRoomEffects({
        roomCode: ROOM_CODE,
        actorUserId: 'host-1',
        commandType: 'werewolf.night.start',
        outcomeKind: 'success',
        previousLifecycle: 'setup',
        lifecycle: 'ongoing',
        committedRevision: 9,
        nowMs: 2_000,
      }),
    ).toEqual([
      {
        type: 'platform.room.gameStarted',
        roomCode: ROOM_CODE,
        startedRevision: 9,
        startedAtMs: 2_000,
      },
    ]);
    expect(
      derivePlatformRoomEffects({
        roomCode: ROOM_CODE,
        actorUserId: 'host-1',
        commandType: 'werewolf.night.start',
        outcomeKind: 'domainRejected',
        previousLifecycle: 'setup',
        lifecycle: 'ongoing',
        committedRevision: 9,
        nowMs: 2_000,
      }),
    ).toEqual([]);
  });

  it('records one game start per room revision under at-least-once delivery', async () => {
    const firstEffect = {
      type: 'platform.room.gameStarted' as const,
      roomCode: ROOM_CODE,
      startedRevision: 9,
      startedAtMs: Date.parse('2026-02-01T00:00:00.000Z'),
    };
    await handlePlatformRoomEffect('effect-1', firstEffect, env);
    await handlePlatformRoomEffect('effect-1', firstEffect, env);
    await handlePlatformRoomEffect('effect-alias', firstEffect, env);
    await handlePlatformRoomEffect(
      'effect-2',
      { ...firstEffect, startedRevision: 15, startedAtMs: firstEffect.startedAtMs + 1_000 },
      env,
    );

    const room = await env.DB.prepare(
      'SELECT games_started, last_started_at FROM rooms WHERE code = ?',
    )
      .bind(ROOM_CODE)
      .first<{ games_started: number; last_started_at: string }>();
    expect(room).toEqual({
      games_started: 2,
      last_started_at: '2026-02-01T00:00:01.000Z',
    });
    const starts = await env.DB.prepare(
      `SELECT effect_id, started_revision
      FROM room_game_starts WHERE room_code = ? ORDER BY started_revision`,
    )
      .bind(ROOM_CODE)
      .all();
    expect(starts.results).toEqual([
      { effect_id: 'effect-1', started_revision: 9 },
      { effect_id: 'effect-2', started_revision: 15 },
    ]);
  });
});
