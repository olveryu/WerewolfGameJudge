/** Game-agnostic post-commit room metadata effects. */

import { z } from 'zod';

import type { Env } from '../../env';

export type PlatformRoomEffect =
  | {
      readonly type: 'platform.room.participantJoined';
      readonly roomCode: string;
      readonly userId: string;
      readonly joinedAtMs: number;
    }
  | {
      readonly type: 'platform.room.gameStarted';
      readonly roomCode: string;
      readonly startedRevision: number;
      readonly startedAtMs: number;
    };

const platformRoomEffectSchema: z.ZodType<PlatformRoomEffect> = z.discriminatedUnion('type', [
  z.strictObject({
    type: z.literal('platform.room.participantJoined'),
    roomCode: z.string().min(1),
    userId: z.string().min(1),
    joinedAtMs: z.number().int().nonnegative(),
  }),
  z.strictObject({
    type: z.literal('platform.room.gameStarted'),
    roomCode: z.string().min(1),
    startedRevision: z.number().int().positive(),
    startedAtMs: z.number().int().nonnegative(),
  }),
]);

interface DerivePlatformEffectsInput {
  readonly roomCode: string;
  readonly actorUserId: string | null;
  readonly commandType: string;
  readonly outcomeKind: 'success' | 'domainRejected';
  readonly previousLifecycle: 'setup' | 'ongoing' | 'ended';
  readonly lifecycle: 'setup' | 'ongoing' | 'ended';
  readonly committedRevision: number;
  readonly nowMs: number;
}

export function derivePlatformRoomEffects(
  input: DerivePlatformEffectsInput,
): readonly PlatformRoomEffect[] {
  if (input.outcomeKind !== 'success') return [];

  const effects: PlatformRoomEffect[] = [];
  if (input.commandType === 'room.seat.take') {
    if (input.actorUserId === null) {
      throw new Error('room.seat.take cannot be committed by a system actor');
    }
    effects.push({
      type: 'platform.room.participantJoined',
      roomCode: input.roomCode,
      userId: input.actorUserId,
      joinedAtMs: input.nowMs,
    });
  }
  if (input.previousLifecycle !== 'ongoing' && input.lifecycle === 'ongoing') {
    effects.push({
      type: 'platform.room.gameStarted',
      roomCode: input.roomCode,
      startedRevision: input.committedRevision,
      startedAtMs: input.nowMs,
    });
  }
  return effects;
}

export function parsePlatformRoomEffect(value: unknown): PlatformRoomEffect {
  return platformRoomEffectSchema.parse(value);
}

export async function handlePlatformRoomEffect(
  effectId: string,
  effect: PlatformRoomEffect,
  env: Env,
): Promise<void> {
  switch (effect.type) {
    case 'platform.room.participantJoined':
      await env.DB.prepare(
        `INSERT INTO room_participants (room_code, user_id, joined_at)
        VALUES (?, ?, ?)
        ON CONFLICT (room_code, user_id) DO NOTHING`,
      )
        .bind(effect.roomCode, effect.userId, new Date(effect.joinedAtMs).toISOString())
        .run();
      return;
    case 'platform.room.gameStarted': {
      const startedAt = new Date(effect.startedAtMs).toISOString();
      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO room_game_starts (
            effect_id,
            room_code,
            started_revision,
            started_at
          ) VALUES (?, ?, ?, ?)
          ON CONFLICT DO NOTHING`,
        ).bind(effectId, effect.roomCode, effect.startedRevision, startedAt),
        env.DB.prepare(
          `UPDATE rooms
          SET
            games_started = (
              SELECT COUNT(*) FROM room_game_starts WHERE room_code = ?
            ),
            last_started_at = (
              SELECT MAX(started_at) FROM room_game_starts WHERE room_code = ?
            ),
            updated_at = MAX(
              updated_at,
              (SELECT MAX(started_at) FROM room_game_starts WHERE room_code = ?)
            )
          WHERE code = ?`,
        ).bind(effect.roomCode, effect.roomCode, effect.roomCode, effect.roomCode),
      ]);
      return;
    }
  }
  const exhaustive: never = effect;
  return exhaustive;
}
