// Durable Object privacy integration for Fashion Shadow.

import {
  FASHION_PUBLIC_STATE_CODEC,
  FASHION_STATE_CODEC,
  type FashionPublicCommand,
  type FashionState,
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

function userIdForSeat(seat: number): string {
  return seat === 0 ? 'fashion-host' : `fashion-player-${seat}`;
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
    const userId = userIdForSeat(seat);
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

async function getAuthoritativeState(stub: DurableObjectStub<GameRoom>): Promise<FashionState> {
  const snapshot = await stub.getSnapshot(roomIdentity(stub));
  if (snapshot === null) throw new Error('Expected authoritative Fashion snapshot');
  return FASHION_STATE_CODEC.parse(snapshot.state);
}

describe('Fashion Shadow private state transport', () => {
  it('persists full authority but returns only the actor projection from commands', async () => {
    const stub = getStub();
    await initialize(stub);
    await seatAndStart(stub);

    const initialAuthority = await getAuthoritativeState(stub);
    const workerEntry = Object.entries(initialAuthority.roles).find(
      ([, role]) => role === 'factoryWorker',
    );
    if (workerEntry === undefined) throw new Error('Expected factory worker');
    const workerSeat = Number(workerEntry[0]);
    const buyerSeat = workerSeat === 0 ? 1 : 0;

    const contractResult = requireCommitted(
      await dispatch(stub, stub, userIdForSeat(workerSeat), 'fashion-contract-propose', {
        type: 'fashion.contract.propose',
        contractId: 'worker-private-contract',
        buyerSeat,
        promise: 'protection',
      }),
    );
    const contractView = FASHION_PUBLIC_STATE_CODEC.parse(contractResult.snapshot.state);
    expect(contractView.privateIdentity?.seat).toBe(workerSeat);
    expect('contracts' in contractView).toBe(false);

    const targetSeat = 1;
    const targetSecret = initialAuthority.secrets[targetSeat];
    if (targetSecret === undefined) throw new Error('Expected target secret');
    const guessResult = requireCommitted(
      await dispatch(stub, stub, 'fashion-host', 'fashion-reveal-secret', {
        type: 'fashion.identityGuess.cast',
        targetSeat,
        guessedSecretId: targetSecret,
      }),
    );
    const hostView = FASHION_PUBLIC_STATE_CODEC.parse(guessResult.snapshot.state);
    expect(hostView.privateIdentity?.seat).toBe(0);
    expect(hostView.revealedSecrets).toEqual({ [targetSeat]: targetSecret });
    expect('roles' in hostView).toBe(false);
    expect('secrets' in hostView).toBe(false);
    expect('votes' in hostView).toBe(false);
    expect('finalVotes' in hostView).toBe(false);
    expect('investigationVoteHistory' in hostView).toBe(false);
    expect('contracts' in hostView).toBe(false);

    const authoritative = await getAuthoritativeState(stub);
    expect(Object.keys(authoritative.roles)).toHaveLength(7);
    expect(Object.keys(authoritative.secrets)).toHaveLength(7);
    expect(authoritative.contracts).toHaveLength(1);
    expect(authoritative.revealedSecrets[targetSeat]).toBe(targetSecret);
    expect(authoritative.investigationVoteHistory).toEqual([]);
    expect(authoritative.finalVotes).toEqual({});
  });

  it('projects reconnect state sync for the socket user', async () => {
    const stub = getStub();
    await initialize(stub);
    await seatAndStart(stub);
    const authority = await getAuthoritativeState(stub);
    const workerEntry = Object.entries(authority.roles).find(
      ([, role]) => role === 'factoryWorker',
    );
    if (workerEntry === undefined) throw new Error('Expected factory worker');
    const workerSeat = Number(workerEntry[0]);
    const buyerSeat = workerSeat === 0 ? 1 : 0;
    requireCommitted(
      await dispatch(stub, stub, userIdForSeat(workerSeat), 'fashion-sync-private-contract', {
        type: 'fashion.contract.propose',
        contractId: 'sync-private-contract',
        buyerSeat,
        promise: 'compensation',
      }),
    );
    const targetSeat = 1;
    const targetSecret = authority.secrets[targetSeat];
    if (targetSecret === undefined) throw new Error('Expected target secret');
    requireCommitted(
      await dispatch(stub, stub, 'fashion-host', 'fashion-sync-reveal-secret', {
        type: 'fashion.identityGuess.cast',
        targetSeat,
        guessedSecretId: targetSecret,
      }),
    );

    await runInDurableObject(stub, async (instance: GameRoom, state) => {
      const sockets = new WebSocketPair();
      state.acceptWebSocket(sockets[1], ['user:fashion-player-2']);
      const received = new Promise<unknown>((resolve, reject) => {
        sockets[0].addEventListener('message', (event) => {
          try {
            if (typeof event.data !== 'string') throw new Error('Expected text sync response');
            resolve(JSON.parse(event.data));
          } catch (error) {
            reject(error instanceof Error ? error : new Error(String(error)));
          }
        });
      });
      sockets[0].accept();

      await instance.webSocketMessage(
        sockets[1],
        JSON.stringify(createStateSyncRequestMessage('fashion-sync-1')),
      );

      const response = parseStateSyncResponseMessage(await received, FASHION_PUBLIC_STATE_CODEC);
      expect(response.requestId).toBe('fashion-sync-1');
      expect(response.state.privateIdentity?.seat).toBe(2);
      expect('roles' in response.state).toBe(false);
      expect('secrets' in response.state).toBe(false);
      expect('votes' in response.state).toBe(false);
      expect('finalVotes' in response.state).toBe(false);
      expect('investigationVoteHistory' in response.state).toBe(false);
      expect('contracts' in response.state).toBe(false);
      expect(response.state.revealedSecrets).toEqual({ [targetSeat]: targetSecret });
      sockets[0].close();
    });
  });
});
