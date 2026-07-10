/** Generic room HTTP authentication, creation, and command contracts. */

import { WEREWOLF_STATE_CODEC } from '@werewolf/game-engine/games/werewolf/public';
import { parseRoomCommandResult } from '@werewolf/game-engine/platform/protocol/commandResult';
import {
  REASON_COMMAND_ID_CONFLICT,
  REASON_ROOM_CODE_CONFLICT,
} from '@werewolf/game-engine/platform/protocol/reasons';
import {
  parseRoomSnapshot,
  type RoomSnapshot,
} from '@werewolf/game-engine/platform/protocol/roomSnapshot';
import type { GameState } from '@werewolf/game-engine/protocol/types';
import { env, SELF } from 'cloudflare:test';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { bootstrapTestSchema } from './testSchemaBootstrap';

interface AuthResponse {
  access_token: string;
  user: { id: string };
}

interface CreateRoomResponse {
  room: {
    roomCode: string;
    gameType: 'werewolf';
    hostUserId: string;
    createdAt: string;
  };
  snapshot: RoomSnapshot<GameState>;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
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
  roomCode: string,
  auth: AuthResponse,
  creationId: string,
): Promise<Response> {
  return postJson(
    '/room/create',
    {
      roomCode,
      gameType: 'werewolf',
      config: { templateRoles: TEMPLATE_ROLES },
      creationId,
    },
    auth.access_token,
  );
}

beforeAll(async () => {
  await bootstrapTestSchema(env.DB);
});

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM room_participants').run();
  await env.DB.prepare('DELETE FROM rooms').run();
});

describe('POST /room/create', () => {
  it('creates server-authored state from game type and config', async () => {
    const auth = await createAnonymousUser();
    const roomCode = 'CREATE-GENERIC';
    const response = await createRoom(roomCode, auth, 'create-generic-1');

    expect(response.status).toBe(200);
    const body = await response.json<CreateRoomResponse>();
    expect(body.room).toMatchObject({
      roomCode,
      gameType: 'werewolf',
      hostUserId: auth.user.id,
    });
    expect(WEREWOLF_STATE_CODEC.parse(body.snapshot.state)).toMatchObject({
      roomCode,
      hostUserId: auth.user.id,
      gameType: 'werewolf',
      stateVersion: 1,
      templateRoles: TEMPLATE_ROLES,
    });
    expect(body.snapshot.revision).toBe(1);

    const stateResponse = await postJson('/room/state', { roomCode });
    expect(stateResponse.status).toBe(200);
    expect(await stateResponse.json()).toEqual({ snapshot: body.snapshot });
  });

  it('rejects client-authored state and unknown game types before writing D1', async () => {
    const auth = await createAnonymousUser();
    const roomCode = 'CREATE-INVALID';

    const stateBlobResponse = await postJson(
      '/room/create',
      {
        roomCode,
        gameType: 'werewolf',
        config: { templateRoles: TEMPLATE_ROLES },
        creationId: 'invalid-create-1',
        initialState: { hostUserId: 'forged' },
      },
      auth.access_token,
    );
    const unknownGameResponse = await postJson(
      '/room/create',
      {
        roomCode,
        gameType: 'unknown-game',
        config: {},
        creationId: 'invalid-create-2',
      },
      auth.access_token,
    );

    expect(stateBlobResponse.status).toBe(400);
    expect(unknownGameResponse.status).toBe(400);
    const directory = await postJson('/room/get', { roomCode });
    expect(await directory.json()).toEqual({ room: null });
  });

  it('returns a validation result for an invalid game config and removes the directory row', async () => {
    const auth = await createAnonymousUser();
    const roomCode = 'CREATE-BAD-CONFIG';
    const response = await postJson(
      '/room/create',
      {
        roomCode,
        gameType: 'werewolf',
        config: { templateRoles: [] },
        creationId: 'bad-config-create',
      },
      auth.access_token,
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ success: false, reason: 'VALIDATION_ERROR' });
    expect(await (await postJson('/room/get', { roomCode })).json()).toEqual({ room: null });
  });

  it('rejects a duplicate room code without replacing its authoritative state', async () => {
    const firstAuth = await createAnonymousUser();
    const secondAuth = await createAnonymousUser();
    const roomCode = 'CREATE-CONFLICT';
    expect((await createRoom(roomCode, firstAuth, 'create-first')).status).toBe(200);

    const conflict = await createRoom(roomCode, secondAuth, 'create-second');
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({
      success: false,
      reason: REASON_ROOM_CODE_CONFLICT,
    });

    const stateResponse = await postJson('/room/state', { roomCode });
    const payload: unknown = await stateResponse.json();
    if (!isRecord(payload) || !('snapshot' in payload)) {
      throw new Error('Invalid /room/state response envelope');
    }
    const snapshot = parseRoomSnapshot(payload.snapshot, WEREWOLF_STATE_CODEC);
    expect(snapshot.state.hostUserId).toBe(firstAuth.user.id);
  });

  it('routes a reused public code to a new DO when the old directory row is gone', async () => {
    const firstAuth = await createAnonymousUser();
    const secondAuth = await createAnonymousUser();
    const roomCode = 'REUSED-CODE';
    expect((await createRoom(roomCode, firstAuth, 'create-before-directory-loss')).status).toBe(
      200,
    );
    const firstDirectory = await env.DB.prepare('SELECT id FROM rooms WHERE code = ?')
      .bind(roomCode)
      .first<{ id: string }>();
    if (firstDirectory === null) throw new Error('First room directory row is missing');

    await env.DB.prepare('DELETE FROM rooms WHERE code = ?').bind(roomCode).run();

    const recreated = await createRoom(roomCode, secondAuth, 'create-after-directory-loss');
    expect(recreated.status).toBe(200);
    const recreatedBody = await recreated.json<CreateRoomResponse>();
    expect(recreatedBody.snapshot.state.hostUserId).toBe(secondAuth.user.id);
    const secondDirectory = await env.DB.prepare('SELECT id FROM rooms WHERE code = ?')
      .bind(roomCode)
      .first<{ id: string }>();
    if (secondDirectory === null) throw new Error('Second room directory row is missing');
    expect(secondDirectory.id).not.toBe(firstDirectory.id);

    const oldRoom = env.GAME_ROOM.get(env.GAME_ROOM.idFromString(firstDirectory.id));
    const oldSnapshot = await oldRoom.getSnapshot();
    expect(oldSnapshot?.state.hostUserId).toBe(firstAuth.user.id);

    const routedState = await postJson('/room/state', { roomCode });
    const routedPayload: unknown = await routedState.json();
    if (!isRecord(routedPayload) || !('snapshot' in routedPayload)) {
      throw new Error('Invalid reused room state envelope');
    }
    const routedSnapshot = parseRoomSnapshot(routedPayload.snapshot, WEREWOLF_STATE_CODEC);
    expect(routedSnapshot.state.hostUserId).toBe(secondAuth.user.id);
  });
});

describe('POST /room/command', () => {
  it('requires auth and derives the seated user only from the token', async () => {
    const host = await createAnonymousUser();
    const player = await createAnonymousUser();
    const roomCode = 'COMMAND-AUTH';
    expect((await createRoom(roomCode, host, 'command-auth-create')).status).toBe(200);
    const command = {
      roomCode,
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
    expect(result.commandId).toBe('player-seat');
    expect(result.snapshot.state.players[1]?.userId).toBe(player.user.id);
  });

  it('replays an identical command and returns 409 for command ID reuse', async () => {
    const auth = await createAnonymousUser();
    const roomCode = 'COMMAND-REPLAY';
    expect((await createRoom(roomCode, auth, 'command-replay-create')).status).toBe(200);
    const command = {
      roomCode,
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
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({
      kind: 'rejected',
      commandId: 'stable-command',
      reason: REASON_COMMAND_ID_CONFLICT,
    });
  });
});
