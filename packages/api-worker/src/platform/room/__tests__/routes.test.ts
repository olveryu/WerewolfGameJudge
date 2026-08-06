/** Generic room HTTP authentication, saga creation, command, and deletion contracts. */

import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import {
  WEREWOLF_STATE_CODEC,
  WEREWOLF_STATE_VERSION,
} from '@game-judge/game-engine/games/werewolf/public';
import { parseRoomCommandResult } from '@game-judge/game-engine/platform/protocol/commandResult';
import {
  REASON_COMMAND_ID_CONFLICT,
  REASON_ROOM_INITIALIZATION_CONFLICT,
} from '@game-judge/game-engine/platform/protocol/reasons';
import { isRoomCode } from '@game-judge/game-engine/platform/protocol/roomCode';
import { env, runInDurableObject, SELF } from 'cloudflare:test';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { deleteCurrentRoomAlarms } from '../../../../test/clearRoomAlarms';
import type { GameRoomRuntime as GameRoom } from '../GameRoomRuntime';

interface AuthResponse {
  access_token: string;
  user: { id: string };
}

interface CreateRoomResponse {
  room: {
    roomCode: string;
    roomId: string;
    gameType: 'werewolf';
    hostUserId: string;
    createdAt: string;
  };
}

interface StateResponse {
  snapshot: {
    gameType: 'werewolf';
    state: GameState;
    revision: number;
  };
}

const TEMPLATE_ROLES = ['wolf', 'seer', 'villager', 'villager'] as const;

async function postJson(path: string, body: unknown, token?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token !== undefined) headers.Authorization = `Bearer ${token}`;
  return SELF.fetch(`https://test.local${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

async function createAnonymousUser(): Promise<AuthResponse> {
  const response = await postJson('/auth/anonymous', {});
  if (!response.ok) {
    throw new Error(`Anonymous authentication failed with HTTP ${response.status}`);
  }
  return response.json<AuthResponse>();
}

async function createRoom(
  auth: AuthResponse,
  creationId: string,
  templateRoles: readonly string[] = TEMPLATE_ROLES,
): Promise<Response> {
  return postJson(
    '/room/create',
    {
      gameType: 'werewolf',
      config: { templateRoles },
      creationId,
    },
    auth.access_token,
  );
}

async function createActiveRoom(
  auth: AuthResponse,
  creationId: string,
): Promise<CreateRoomResponse> {
  const response = await createRoom(auth, creationId);
  expect(response.status).toBe(200);
  return response.json<CreateRoomResponse>();
}

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM room_participants').run();
  await env.DB.prepare('DELETE FROM room_game_starts').run();
  await env.DB.prepare('DELETE FROM rooms').run();
});

afterEach(deleteCurrentRoomAlarms);

describe('POST /room/create', () => {
  it('allocates the public code and creates server-authored state', async () => {
    const auth = await createAnonymousUser();
    const body = await createActiveRoom(auth, 'create-generic-1');

    expect(isRoomCode(body.room.roomCode)).toBe(true);
    expect(body.room).toMatchObject({
      gameType: 'werewolf',
      hostUserId: auth.user.id,
    });
    const state = await postJson('/room/state', {
      roomCode: body.room.roomCode,
      roomId: body.room.roomId,
    });
    const stateBody = await state.json<StateResponse>();
    expect(WEREWOLF_STATE_CODEC.parse(stateBody.snapshot.state)).toMatchObject({
      roomCode: body.room.roomCode,
      hostUserId: auth.user.id,
      gameType: 'werewolf',
      stateVersion: WEREWOLF_STATE_VERSION,
      templateRoles: TEMPLATE_ROLES,
    });
    expect(stateBody.snapshot.revision).toBe(1);

    const directory = await postJson('/room/get', { roomCode: body.room.roomCode });
    expect(await directory.json()).toEqual({ room: body.room });
    expect(state.status).toBe(200);
  });

  it('rejects client routing fields, unknown games, and invalid config before D1 claim', async () => {
    const auth = await createAnonymousUser();
    const clientRouting = await postJson(
      '/room/create',
      {
        roomCode: '1234',
        gameType: 'werewolf',
        config: { templateRoles: TEMPLATE_ROLES },
        creationId: 'invalid-create-routing',
        initialState: { hostUserId: 'forged' },
      },
      auth.access_token,
    );
    const unknownGame = await postJson(
      '/room/create',
      { gameType: 'unknown-game', config: {}, creationId: 'invalid-create-game' },
      auth.access_token,
    );
    const invalidConfig = await createRoom(auth, 'invalid-create-config', []);

    expect(clientRouting.status).toBe(400);
    expect(unknownGame.status).toBe(400);
    expect(invalidConfig.status).toBe(400);
    const count = await env.DB.prepare('SELECT COUNT(*) AS count FROM rooms').first<{
      count: number;
    }>();
    expect(count?.count).toBe(0);
  });

  it('replays the exact creation identity and rejects changed actor or config', async () => {
    const host = await createAnonymousUser();
    const other = await createAnonymousUser();
    const first = await createActiveRoom(host, 'stable-creation');
    const replayResponse = await createRoom(host, 'stable-creation');
    expect(replayResponse.status).toBe(200);
    expect(await replayResponse.json()).toEqual(first);

    const changedActor = await createRoom(other, 'stable-creation');
    expect(changedActor.status).toBe(409);
    expect(await changedActor.json()).toEqual({
      success: false,
      reason: REASON_ROOM_INITIALIZATION_CONFLICT,
    });
    const changedConfig = await createRoom(host, 'stable-creation', [
      'wolf',
      'villager',
      'villager',
      'villager',
    ]);
    expect(changedConfig.status).toBe(409);
  });
});

describe('POST /room/command', () => {
  it('requires auth and derives the seated user only from the token', async () => {
    const host = await createAnonymousUser();
    const player = await createAnonymousUser();
    const created = await createActiveRoom(host, 'command-auth-create');
    const command = {
      roomCode: created.room.roomCode,
      roomId: created.room.roomId,
      commandId: 'player-seat',
      controlledSeat: null,
      command: {
        type: 'room.seat.take',
        seat: 1,
        profile: { displayName: '玩家' },
      },
    };

    expect((await postJson('/room/command', command)).status).toBe(401);
    const forged = await postJson(
      '/room/command',
      { ...command, actorUserId: host.user.id },
      player.access_token,
    );
    expect(forged.status).toBe(400);

    const response = await postJson('/room/command', command, player.access_token);
    expect(response.status).toBe(200);
    const result = parseRoomCommandResult(await response.json(), WEREWOLF_STATE_CODEC);
    expect(result.kind).toBe('committed');
    if (result.kind !== 'committed') throw new Error(result.reason);
    expect(result.snapshot.state.players[1]?.userId).toBe(player.user.id);
  });

  it('returns unavailable transport status without fabricating a command decision', async () => {
    const auth = await createAnonymousUser();
    const response = await postJson(
      '/room/command',
      {
        roomCode: '9999',
        roomId: env.GAME_ROOM.newUniqueId().toString(),
        commandId: 'missing-room-command',
        controlledSeat: null,
        command: { type: 'room.seat.leave' },
      },
      auth.access_token,
    );

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ success: false, reason: 'no_state' });
  });

  it('replays an identical command and decodes command ID conflicts as decisions', async () => {
    const auth = await createAnonymousUser();
    const created = await createActiveRoom(auth, 'command-replay-create');
    const command = {
      roomCode: created.room.roomCode,
      roomId: created.room.roomId,
      commandId: 'stable-command',
      controlledSeat: null,
      command: {
        type: 'room.seat.take',
        seat: 0,
        profile: { displayName: '房主' },
      },
    };

    const first = await postJson('/room/command', command, auth.access_token);
    const replay = await postJson('/room/command', command, auth.access_token);
    expect(first.status).toBe(200);
    expect(replay.status).toBe(200);
    expect(await replay.json()).toEqual(await first.json());

    const conflict = await postJson(
      '/room/command',
      { ...command, command: { type: 'room.seat.leave' } },
      auth.access_token,
    );
    const conflictResult = parseRoomCommandResult(await conflict.json(), WEREWOLF_STATE_CODEC);
    expect(conflictResult).toEqual({
      kind: 'rejected',
      commandId: 'stable-command',
      reason: REASON_COMMAND_ID_CONFLICT,
    });
  });

  it('rejects a stale room instance after resolving a reusable public code', async () => {
    const auth = await createAnonymousUser();
    const created = await createActiveRoom(auth, 'stale-instance-create');
    const staleRoomId = env.GAME_ROOM.newUniqueId().toString();
    const staleLocator = { roomCode: created.room.roomCode, roomId: staleRoomId };

    const command = await postJson(
      '/room/command',
      {
        ...staleLocator,
        commandId: 'stale-instance-command',
        controlledSeat: null,
        command: { type: 'room.seat.leave' },
      },
      auth.access_token,
    );
    const state = await postJson('/room/state', staleLocator);
    const deletion = await postJson('/room/delete', staleLocator, auth.access_token);

    for (const response of [command, state, deletion]) {
      expect(response.status).toBe(409);
      expect(await response.json()).toEqual({
        success: false,
        reason: 'room_instance_mismatch',
      });
    }
  });

  it('surfaces an active directory row without DO state as an integrity failure', async () => {
    const roomId = env.GAME_ROOM.newUniqueId().toString();
    await env.DB.prepare(
      `INSERT INTO rooms (
        id, code, game_type, host_user_id, creation_id, config_json, status,
        created_at, updated_at, games_started
      ) VALUES (?, '6789', 'werewolf', 'host-1', 'missing-do-state',
        '{"templateRoles":["wolf","seer","villager","villager"]}', 'active',
        '2026-07-10T12:00:00.000Z', '2026-07-10T12:00:00.000Z', 0)`,
    )
      .bind(roomId)
      .run();

    const response = await postJson('/room/state', { roomCode: '6789', roomId });
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ success: false, reason: 'INTERNAL_ERROR' });
  });
});

describe('POST /room/delete', () => {
  it('keeps an active room available until outstanding effects are resolved', async () => {
    const auth = await createAnonymousUser();
    const created = await createActiveRoom(auth, 'delete-outbox-create');
    const roomCode = created.room.roomCode;
    const roomId = created.room.roomId;
    const stub = env.GAME_ROOM.get(env.GAME_ROOM.idFromString(roomId));
    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      state.storage.sql.exec(`
        INSERT INTO effect_outbox (
          id, origin_command_id, scope, game_type, effect_type, business_key,
          payload_json, status, attempt_count, available_at, created_revision,
          created_at, last_error
        ) VALUES (
          'pending-delete-effect', 'pending-delete-command', 'platform', 'werewolf',
          'room.participant.seated', 'pending-delete-business-key', '{}', 'pending',
          1, 0, 1, 0, 'delivery pending'
        )
      `);
    });

    const blocked = await postJson('/room/delete', { roomCode, roomId }, auth.access_token);
    expect(blocked.status).toBe(409);
    expect(await blocked.json()).toEqual({
      success: false,
      reason: 'room_effects_pending',
    });
    expect(await (await postJson('/room/get', { roomCode })).json()).toMatchObject({
      room: { roomCode },
    });

    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      state.storage.sql.exec("DELETE FROM effect_outbox WHERE id = 'pending-delete-effect'");
    });
    const deleted = await postJson('/room/delete', { roomCode, roomId }, auth.access_token);
    expect(deleted.status).toBe(200);
    expect(await deleted.json()).toEqual({ success: true, pending: false });
    expect(await (await postJson('/room/get', { roomCode })).json()).toEqual({ room: null });
    await expect(
      stub.getSnapshot({ roomCode, roomId, creationId: 'delete-outbox-create' }),
    ).resolves.toBeNull();
  });
});
