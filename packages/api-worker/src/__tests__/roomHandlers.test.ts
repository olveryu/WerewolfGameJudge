/** Room HTTP routes — metadata and Durable Object consistency contracts. */

import { buildInitialGameState } from '@werewolf/game-engine/engine/state/buildInitialState';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
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
    hostUserId: string;
    createdAt: string;
  };
}

interface RoomStateResponse {
  state: GameState | null;
  revision?: number;
}

const TEMPLATE: GameTemplate = {
  name: 'Room route contract',
  numberOfPlayers: 4,
  roles: ['wolf', 'seer', 'villager', 'villager'],
};

async function postJson(path: string, body: unknown, token?: string): Promise<Response> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
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

beforeAll(async () => {
  await bootstrapTestSchema(env.DB);
});

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM room_participants').run();
  await env.DB.prepare('DELETE FROM rooms').run();
});

describe('POST /room/create', () => {
  it('creates matching D1 metadata and Durable Object state', async () => {
    const auth = await createAnonymousUser();
    const roomCode = 'CREATE-CONTRACT';
    const initialState = buildInitialGameState(roomCode, auth.user.id, TEMPLATE);

    const createResponse = await postJson(
      '/room/create',
      { roomCode, initialState },
      auth.access_token,
    );

    expect(createResponse.status).toBe(200);
    const createBody = await createResponse.json<CreateRoomResponse>();
    expect(createBody.room.roomCode).toBe(roomCode);
    expect(createBody.room.hostUserId).toBe(auth.user.id);

    const metadataResponse = await postJson('/room/get', { roomCode });
    expect(metadataResponse.status).toBe(200);
    expect(await metadataResponse.json()).toMatchObject({
      room: { roomCode, hostUserId: auth.user.id },
    });

    const stateResponse = await postJson('/room/state', { roomCode });
    expect(stateResponse.status).toBe(200);
    const stateBody = await stateResponse.json<RoomStateResponse>();
    expect(stateBody.revision).toBe(1);
    expect(stateBody.state).toMatchObject({
      roomCode,
      hostUserId: auth.user.id,
      templateRoles: TEMPLATE.roles,
      players: initialState.players,
    });
  });

  it('rejects a duplicate room code without replacing the existing DO state', async () => {
    const firstAuth = await createAnonymousUser();
    const secondAuth = await createAnonymousUser();
    const roomCode = 'CREATE-CONFLICT';
    const firstState = buildInitialGameState(roomCode, firstAuth.user.id, TEMPLATE);
    const secondState = buildInitialGameState(roomCode, secondAuth.user.id, TEMPLATE);

    const firstResponse = await postJson(
      '/room/create',
      { roomCode, initialState: firstState },
      firstAuth.access_token,
    );
    expect(firstResponse.status).toBe(200);

    const conflictResponse = await postJson(
      '/room/create',
      { roomCode, initialState: secondState },
      secondAuth.access_token,
    );
    expect(conflictResponse.status).toBe(409);
    expect(await conflictResponse.json()).toEqual({
      success: false,
      reason: 'ROOM_CODE_CONFLICT',
    });

    const stateResponse = await postJson('/room/state', { roomCode });
    const stateBody = await stateResponse.json<RoomStateResponse>();
    expect(stateBody.state?.hostUserId).toBe(firstAuth.user.id);
    expect(stateBody.state?.hostUserId).not.toBe(secondAuth.user.id);
  });
});
