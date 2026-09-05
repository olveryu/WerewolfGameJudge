// Durable Object privacy integration for Fashion Shadow.

import {
  FASHION_PUBLIC_STATE_CODEC,
  FASHION_STATE_CODEC,
  type FashionPublicCommand,
} from '@game-judge/game-engine/games/fashion-shadow/public';
import {
  createStateSyncRequestMessage,
  parseStateSyncResponseMessage,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { deleteCurrentRoomAlarms } from '../../../../test/clearRoomAlarms';
import type { GameRoomRuntime as GameRoom } from '../../../platform/room/GameRoomRuntime';
import type { DispatchRoomResult, InitializeRoomResult } from '../../../platform/room/types';

const ROOM_CODE = '7451';

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM user_event_inbox').run();
  await env.DB.prepare('DELETE FROM room_participants').run();
  await env.DB.prepare('DELETE FROM room_game_starts').run();
  await env.DB.prepare('DELETE FROM rooms').run();
  await env.DB.prepare("DELETE FROM users WHERE id LIKE 'fashion-%'").run();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO users (id) VALUES ('fashion-host')"),
    ...Array.from({ length: 6 }, (_, index) =>
      env.DB.prepare('INSERT INTO users (id) VALUES (?)').bind(`fashion-player-${index + 1}`),
    ),
  ]);
});

afterEach(deleteCurrentRoomAlarms);

function getStub(): DurableObjectStub<GameRoom> {
  return env.GAME_ROOM.get(env.GAME_ROOM.newUniqueId());
}

function roomIdentity(stub: DurableObjectStub<GameRoom>) {
  return {
    roomCode: ROOM_CODE,
    roomId: stub.id.toString(),
    creationId: 'fashion-creation-1',
  };
}

async function ensureDirectory(stub: DurableObjectStub<GameRoom>): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO rooms (
      id, code, game_type, host_user_id, creation_id, config_json, status,
      created_at, updated_at, games_started
    ) VALUES (?, ?, 'fashion-shadow', 'fashion-host', 'fashion-creation-1',
      '{"numberOfPlayers":7}', 'active',
      '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 0)`,
  )
    .bind(stub.id.toString(), ROOM_CODE)
    .run();
}

async function initialize(stub: DurableObjectStub<GameRoom>): Promise<InitializeRoomResult> {
  await ensureDirectory(stub);
  return stub.initializeRoom({
    ...roomIdentity(stub),
    gameType: 'fashion-shadow',
    hostUserId: 'fashion-host',
    config: { numberOfPlayers: 7 },
  });
}

async function dispatch(
  target: Pick<GameRoom, 'dispatchUserCommand'>,
  stub: DurableObjectStub<GameRoom>,
  actorUserId: string,
  commandId: string,
  command: FashionPublicCommand,
): Promise<DispatchRoomResult> {
  return target.dispatchUserCommand({
    ...roomIdentity(stub),
    commandId,
    actorUserId,
    controlledSeat: null,
    command,
  });
}

function requireCommitted(result: DispatchRoomResult) {
  if (result.kind !== 'decided') throw new Error(result.reason);
  if (result.result.kind !== 'committed') throw new Error(result.result.reason);
  return result.result;
}

async function seatAndStart(stub: DurableObjectStub<GameRoom>): Promise<void> {
  for (let seat = 0; seat < 7; seat += 1) {
    const userId = seat === 0 ? 'fashion-host' : `fashion-player-${seat}`;
    requireCommitted(
      await dispatch(stub, stub, userId, `fashion-seat-${seat}`, {
        type: 'room.seat.take',
        seat,
        profile: { displayName: `Player ${seat}` },
      }),
    );
  }
  requireCommitted(
    await dispatch(stub, stub, 'fashion-host', 'fashion-start', {
      type: 'fashion.game.start',
    }),
  );
}

describe('Fashion Shadow private state transport', () => {
  it('persists full authority but returns only the actor projection from commands', async () => {
    const stub = getStub();
    await initialize(stub);
    await seatAndStart(stub);

    const hostResult = requireCommitted(
      await dispatch(stub, stub, 'fashion-host', 'fashion-host-confirm', {
        type: 'fashion.role.confirm',
      }),
    );
    const hostView = FASHION_PUBLIC_STATE_CODEC.parse(hostResult.snapshot.state);
    expect(hostView.privateIdentity?.seat).toBe(0);
    expect('roles' in hostView).toBe(false);
    expect('secrets' in hostView).toBe(false);
    expect('votes' in hostView).toBe(false);

    const playerResult = requireCommitted(
      await dispatch(stub, stub, 'fashion-player-1', 'fashion-player-1-confirm', {
        type: 'fashion.role.confirm',
      }),
    );
    const playerView = FASHION_PUBLIC_STATE_CODEC.parse(playerResult.snapshot.state);
    expect(playerView.privateIdentity?.seat).toBe(1);
    expect(playerView.privateIdentity).not.toEqual(hostView.privateIdentity);

    const authoritativeSnapshot = await stub.getSnapshot(roomIdentity(stub));
    if (authoritativeSnapshot === null) throw new Error('Expected authoritative Fashion snapshot');
    const authoritative = FASHION_STATE_CODEC.parse(authoritativeSnapshot.state);
    expect(Object.keys(authoritative.roles)).toHaveLength(7);
    expect(Object.keys(authoritative.secrets)).toHaveLength(7);
  });

  it('projects reconnect state sync for the socket user', async () => {
    const stub = getStub();
    await initialize(stub);
    await seatAndStart(stub);

    await runInDurableObject(stub, async (instance: GameRoom, state) => {
      const sockets = new WebSocketPair();
      state.acceptWebSocket(sockets[1], ['user:fashion-player-2']);
      const received = new Promise<unknown>((resolve, reject) => {
        sockets[0].addEventListener('message', (event) => {
          try {
            if (typeof event.data !== 'string') throw new Error('Expected text sync response');
            resolve(JSON.parse(event.data));
          } catch (error) {
            reject(error);
          }
        });
      });
      sockets[0].accept();

      await instance.webSocketMessage(
        sockets[1],
        JSON.stringify(createStateSyncRequestMessage('fashion-sync-1')),
      );

      const response = parseStateSyncResponseMessage(
        await received,
        FASHION_PUBLIC_STATE_CODEC,
      );
      expect(response.requestId).toBe('fashion-sync-1');
      expect(response.state.privateIdentity?.seat).toBe(2);
      expect('roles' in response.state).toBe(false);
      expect('secrets' in response.state).toBe(false);
      expect('votes' in response.state).toBe(false);
      sockets[0].close();
    });
  });
});
