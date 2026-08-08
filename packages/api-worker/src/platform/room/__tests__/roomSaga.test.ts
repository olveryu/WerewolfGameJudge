/** Interrupted create/delete recovery across D1 and Durable Object storage. */

import { canonicalJson } from '@game-judge/game-engine/platform/protocol/canonicalJson';
import { env, runInDurableObject } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

import type { GameRoomRuntime as GameRoom } from '../GameRoomRuntime';
import {
  beginRoomDeletion,
  claimRoomCreation,
  findRoomByCreationId,
  type RoomDirectoryRecord,
  SYSTEM_ROOM_EXPIRY_ACTOR,
} from '../roomDirectory';
import { reconcileRoomDirectory, resumeRoomCreation } from '../roomSaga';

const NOW_MS = Date.parse('2026-07-10T12:00:00.000Z');
const CONFIG = { templateRoles: ['wolf', 'seer', 'villager', 'villager'] } as const;

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM room_participants').run();
  await env.DB.prepare('DELETE FROM room_game_starts').run();
  await env.DB.prepare('DELETE FROM rooms').run();
});

async function claim(creationId: string): Promise<RoomDirectoryRecord> {
  const result = await claimRoomCreation(
    env,
    {
      gameType: 'werewolf',
      hostUserId: 'host-1',
      creationId,
      configJson: canonicalJson(CONFIG),
    },
    NOW_MS,
  );
  if (result.kind === 'conflict') throw new Error('Unexpected creation conflict');
  return result.room;
}

function getStub(room: RoomDirectoryRecord): DurableObjectStub<GameRoom> {
  return env.GAME_ROOM.get(env.GAME_ROOM.idFromString(room.id));
}

describe('room saga reconciliation', () => {
  it('activates a creating row when DO initialization committed before interruption', async () => {
    const room = await claim('interrupted-create');
    const initialized = await getStub(room).initializeRoom({
      roomCode: room.code,
      roomId: room.id,
      gameType: room.gameType,
      hostUserId: room.hostUserId,
      config: CONFIG,
      creationId: room.creationId,
    });
    expect(initialized.success).toBe(true);
    expect((await findRoomByCreationId(env, room.creationId))?.status).toBe('creating');

    await expect(reconcileRoomDirectory(env, NOW_MS)).resolves.toBe(1);
    expect((await findRoomByCreationId(env, room.creationId))?.status).toBe('active');
    await expect(
      getStub(room).getSnapshot({
        roomCode: room.code,
        roomId: room.id,
        creationId: room.creationId,
      }),
    ).resolves.toEqual(initialized.success ? initialized.snapshot : null);
  });

  it('finishes deletion when D1 was marked before DO cleanup', async () => {
    const claimed = await claim('interrupted-delete-before-do');
    const { room } = await resumeRoomCreation(env, claimed, NOW_MS);
    const deleting = await beginRoomDeletion(env, room, 'host-1', NOW_MS + 1);

    await expect(reconcileRoomDirectory(env, NOW_MS + 1)).resolves.toBe(1);
    expect(await findRoomByCreationId(env, room.creationId)).toBeNull();
    await expect(
      getStub(deleting).getSnapshot({
        roomCode: deleting.code,
        roomId: deleting.id,
        creationId: deleting.creationId,
      }),
    ).resolves.toBeNull();
  });

  it('removes the directory row when DO cleanup committed before interruption', async () => {
    const claimed = await claim('interrupted-delete-after-do');
    const { room } = await resumeRoomCreation(env, claimed, NOW_MS);
    const deleting = await beginRoomDeletion(env, room, 'host-1', NOW_MS + 1);
    await expect(
      getStub(deleting).deleteRoomStorage({
        roomCode: deleting.code,
        roomId: deleting.id,
        creationId: deleting.creationId,
        shouldDiscardFailedEffects: false,
      }),
    ).resolves.toEqual({ success: true });
    expect((await findRoomByCreationId(env, room.creationId))?.status).toBe('deleting');

    await expect(reconcileRoomDirectory(env, NOW_MS + 1)).resolves.toBe(1);
    expect(await findRoomByCreationId(env, room.creationId)).toBeNull();
  });

  it('keeps deletion recoverable while outbox delivery is outstanding', async () => {
    const claimed = await claim('delete-waits-outbox');
    const { room } = await resumeRoomCreation(env, claimed, NOW_MS);
    const deleting = await beginRoomDeletion(env, room, 'host-1', NOW_MS + 1);
    const stub = getStub(deleting);
    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      state.storage.sql.exec(`
        INSERT INTO effect_outbox (
          id, origin_command_id, scope, game_type, effect_type, business_key,
          payload_json, status, attempt_count, available_at, created_revision,
          created_at, last_error
        ) VALUES (
          'saga-effect', 'saga-command', 'platform', 'werewolf',
          'room.participant.seated', 'saga-business-key', '{}', 'failed',
          7, 0, 1, 0, 'delivery exhausted'
        )
      `);
    });

    await expect(reconcileRoomDirectory(env, NOW_MS + 1)).rejects.toThrow(
      'room saga reconciliation failures',
    );
    const blocked = await findRoomByCreationId(env, room.creationId);
    expect(blocked).toMatchObject({
      status: 'deleting',
      reconciliationAttemptCount: 1,
    });

    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      state.storage.sql.exec("DELETE FROM effect_outbox WHERE id = 'saga-effect'");
    });
    await expect(reconcileRoomDirectory(env, NOW_MS + 5 * 60_000 + 1)).resolves.toBe(1);
    expect(await findRoomByCreationId(env, room.creationId)).toBeNull();
  });

  it('discards terminal outbox failures when a stale room expires', async () => {
    const claimed = await claim('expired-delete-failed-outbox');
    const { room } = await resumeRoomCreation(env, claimed, NOW_MS);
    const deleting = await beginRoomDeletion(env, room, SYSTEM_ROOM_EXPIRY_ACTOR, NOW_MS + 1);
    const stub = getStub(deleting);
    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      state.storage.sql.exec(`
        INSERT INTO effect_outbox (
          id, origin_command_id, scope, game_type, effect_type, business_key,
          payload_json, status, attempt_count, available_at, created_revision,
          created_at, last_error
        ) VALUES (
          'expired-failed-effect', 'expired-failed-command', 'platform', 'werewolf',
          'room.participant.seated', 'expired-failed-business-key', '{}', 'failed',
          7, 0, 1, 0, 'delivery exhausted'
        )
      `);
    });

    await expect(reconcileRoomDirectory(env, NOW_MS + 1)).resolves.toBe(1);
    expect(await findRoomByCreationId(env, room.creationId)).toBeNull();
    await expect(
      stub.getSnapshot({
        roomCode: deleting.code,
        roomId: deleting.id,
        creationId: deleting.creationId,
      }),
    ).resolves.toBeNull();
  });

  it('keeps stale-room deletion blocked while outbox delivery is pending', async () => {
    const claimed = await claim('expired-delete-pending-outbox');
    const { room } = await resumeRoomCreation(env, claimed, NOW_MS);
    const deleting = await beginRoomDeletion(env, room, SYSTEM_ROOM_EXPIRY_ACTOR, NOW_MS + 1);
    const stub = getStub(deleting);
    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      state.storage.sql.exec(
        `
        INSERT INTO effect_outbox (
          id, origin_command_id, scope, game_type, effect_type, business_key,
          payload_json, status, attempt_count, available_at, created_revision,
          created_at, last_error
        ) VALUES (
          'expired-pending-effect', 'expired-pending-command', 'platform', 'werewolf',
          'room.participant.seated', 'expired-pending-business-key', '{}', 'pending',
          1, ?, 1, 0, NULL
        )
      `,
        NOW_MS + 60_000,
      );
    });

    await expect(reconcileRoomDirectory(env, NOW_MS + 1)).rejects.toThrow(
      'room saga reconciliation failures',
    );
    expect(await findRoomByCreationId(env, room.creationId)).toMatchObject({
      status: 'deleting',
      reconciliationAttemptCount: 1,
    });
  });

  it('fails fast when persisted config is valid JSON but not canonical JSON', async () => {
    const roomId = env.GAME_ROOM.newUniqueId().toString();
    await env.DB.prepare(
      `INSERT INTO rooms (
        id, code, game_type, host_user_id, creation_id, config_json, status,
        created_at, updated_at, games_started
      ) VALUES (?, '7654', 'werewolf', 'host-1', 'noncanonical-config',
        '{"templateRoles": ["wolf","seer","villager","villager"]}', 'active',
        '2026-07-10T12:00:00.000Z', '2026-07-10T12:00:00.000Z', 0)`,
    )
      .bind(roomId)
      .run();

    await expect(findRoomByCreationId(env, 'noncanonical-config')).rejects.toThrow(
      'rooms.config_json must use canonical JSON encoding',
    );
  });
});
