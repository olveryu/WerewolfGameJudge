/** Generic room Durable Object integration and idempotency contracts. */

import {
  WEREWOLF_STATE_CODEC,
  type WerewolfPublicCommand,
} from '@werewolf/game-engine/games/werewolf/public';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import {
  REASON_COMMAND_ID_CONFLICT,
  REASON_NO_STATE,
  REASON_ROOM_INITIALIZATION_CONFLICT,
  REASON_SEAT_EMPTY,
} from '@werewolf/game-engine/platform/protocol/reasons';
import { createUserEventAckMessage } from '@werewolf/game-engine/platform/protocol/userEvents';
import { runDurableObjectAlarm, runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';

import type { GameRoom } from '../platform/room/GameRoom';
import { initializeRoomStorage } from '../platform/room/storageSchema';
import type { DispatchRoomResult, InitializeRoomResult } from '../platform/room/types';
import { enqueueUserEvent } from '../platform/userEvents/inbox';
import { bootstrapTestSchema } from './testSchemaBootstrap';

const ROOM_CODE = 'GENERIC-ROOM';
const TEMPLATE_ROLES = ['wolf', 'seer', 'villager', 'villager'] as const;

beforeAll(async () => {
  await bootstrapTestSchema(env.DB);
});

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM user_event_inbox').run();
  await env.DB.prepare('DELETE FROM room_participants').run();
  await env.DB.prepare('DELETE FROM room_game_starts').run();
  await env.DB.prepare('DELETE FROM rooms').run();
  await env.DB.prepare("DELETE FROM users WHERE id IN ('host-1', 'player-1')").run();
  await env.DB.prepare("INSERT INTO users (id) VALUES ('host-1'), ('player-1')").run();
  await env.DB.prepare(
    `INSERT INTO rooms (
      id, code, host_user_id, created_at, updated_at, games_started
    ) VALUES ('generic-room-id', ?, 'host-1', '2026-01-01T00:00:00.000Z',
      '2026-01-01T00:00:00.000Z', 0)`,
  )
    .bind(ROOM_CODE)
    .run();
});

function getStub(): DurableObjectStub<GameRoom> {
  return env.GAME_ROOM.get(env.GAME_ROOM.newUniqueId());
}

async function initialize(
  stub: DurableObjectStub<GameRoom>,
  creationId = 'creation-1',
): Promise<InitializeRoomResult> {
  return stub.initializeRoom({
    roomCode: ROOM_CODE,
    gameType: 'werewolf',
    hostUserId: 'host-1',
    config: { templateRoles: TEMPLATE_ROLES },
    creationId,
  });
}

async function dispatch(
  stub: DurableObjectStub<GameRoom>,
  input: {
    readonly commandId: string;
    readonly actorUserId: string;
    readonly command: WerewolfPublicCommand;
    readonly controlledSeat?: number | null;
  },
): Promise<DispatchRoomResult> {
  return stub.dispatchUserCommand({
    roomCode: ROOM_CODE,
    commandId: input.commandId,
    actorUserId: input.actorUserId,
    controlledSeat: input.controlledSeat ?? null,
    command: input.command,
  });
}

function requireCommitted(result: DispatchRoomResult) {
  if (result.kind !== 'decided') {
    throw new Error(`Expected decided command, received ${result.reason}`);
  }
  if (result.result.kind !== 'committed') {
    throw new Error(`Expected committed command, received ${result.result.reason}`);
  }
  return {
    ...result,
    result: {
      ...result.result,
      snapshot: {
        ...result.result.snapshot,
        state: WEREWOLF_STATE_CODEC.parse(result.result.snapshot.state),
      },
    },
  };
}

describe('GameRoom initialization', () => {
  it('fails fast before initialization instead of hanging', async () => {
    const stub = getStub();

    await expect(stub.getSnapshot()).resolves.toBeNull();
    await expect(stub.getRevision()).resolves.toBeNull();
    await expect(
      dispatch(stub, {
        commandId: 'before-init',
        actorUserId: 'host-1',
        command: { type: 'werewolf.roles.assign' },
      }),
    ).resolves.toEqual({ kind: 'unavailable', reason: REASON_NO_STATE });
  });

  it('creates state from config and replays only the exact creation command', async () => {
    const stub = getStub();
    const first = await initialize(stub);
    const replay = await initialize(stub);
    const conflict = await initialize(stub, 'creation-2');

    expect(first).toMatchObject({ success: true, isReplay: false });
    expect(replay).toMatchObject({ success: true, isReplay: true });
    expect(conflict).toEqual({
      success: false,
      reason: REASON_ROOM_INITIALIZATION_CONFLICT,
    });
    if (!first.success) throw new Error(first.reason);
    const state = WEREWOLF_STATE_CODEC.parse(first.snapshot.state);
    expect(state).toMatchObject({
      gameType: 'werewolf',
      stateVersion: 1,
      roomCode: ROOM_CODE,
      hostUserId: 'host-1',
      status: GameStatus.Unseated,
      templateRoles: TEMPLATE_ROLES,
    });
  });

  it('validates the current schema idempotently', async () => {
    const stub = getStub();
    await stub.getSnapshot();

    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      initializeRoomStorage(state.storage, Date.now());
      initializeRoomStorage(state.storage, Date.now() + 1);

      expect(
        state.storage.sql.exec('SELECT id FROM _sql_schema_migrations ORDER BY id').toArray(),
      ).toEqual([{ id: 1 }]);
    });
  });

  it('rejects an unversioned room schema without replacing it', async () => {
    const stub = getStub();
    await stub.getSnapshot();

    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      await state.storage.deleteAlarm();
      await state.storage.deleteAll();
      state.storage.sql.exec(`
        CREATE TABLE room_state (
          id INTEGER PRIMARY KEY,
          game_state TEXT NOT NULL,
          revision INTEGER NOT NULL
        )
      `);
      state.storage.sql.exec(
        "INSERT INTO room_state (id, game_state, revision) VALUES (1, '{}', 3)",
      );

      expect(() => initializeRoomStorage(state.storage, Date.now())).toThrow(
        'Unsupported unversioned room_state schema: id,game_state,revision',
      );
      expect(
        state.storage.sql
          .exec<{ name: string }>('PRAGMA table_info(room_state)')
          .toArray()
          .map((column) => column.name),
      ).toEqual(['id', 'game_state', 'revision']);
    });
  });

  it('rejects a future schema version', async () => {
    const stub = getStub();
    await stub.getSnapshot();

    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      await state.storage.deleteAll();
      state.storage.sql.exec(`
        CREATE TABLE _sql_schema_migrations (
          id INTEGER PRIMARY KEY,
          applied_at INTEGER NOT NULL
        ) STRICT;
        INSERT INTO _sql_schema_migrations (id, applied_at) VALUES (2, 0);
      `);

      expect(() => initializeRoomStorage(state.storage, Date.now())).toThrow(
        'Unsupported Durable Object schema version: 2',
      );
    });
  });
});

describe('GameRoom command receipts', () => {
  it('uses the authenticated actor identity and replays an identical command once', async () => {
    const stub = getStub();
    await initialize(stub);
    const request = {
      commandId: 'seat-host',
      actorUserId: 'host-1',
      command: {
        type: 'room.seat.take',
        seat: 0,
        profile: { displayName: '房主' },
      },
    } as const;

    const first = requireCommitted(await dispatch(stub, request));
    const replay = requireCommitted(await dispatch(stub, request));

    expect(first.isReplay).toBe(false);
    expect(first.result.snapshot.revision).toBe(2);
    expect(first.result.snapshot.state.players[0]?.userId).toBe('host-1');
    expect(replay.isReplay).toBe(true);
    expect(replay.result).toEqual(first.result);
    expect(await stub.getRevision()).toBe(2);
  });

  it('advances revision for a committed state event even when JSON values are unchanged', async () => {
    const stub = getStub();
    await initialize(stub);
    await dispatch(stub, {
      commandId: 'seat-for-noop-profile',
      actorUserId: 'host-1',
      command: {
        type: 'room.seat.take',
        seat: 0,
        profile: { displayName: '房主' },
      },
    });

    const update = requireCommitted(
      await dispatch(stub, {
        commandId: 'same-profile-value',
        actorUserId: 'host-1',
        command: {
          type: 'room.profile.update',
          profile: { displayName: '房主' },
        },
      }),
    );

    expect(update.result.snapshot.revision).toBe(3);
    expect(await stub.getRevision()).toBe(3);
  });

  it('rejects command ID reuse by another actor or request body', async () => {
    const stub = getStub();
    await initialize(stub);
    await dispatch(stub, {
      commandId: 'bound-command',
      actorUserId: 'host-1',
      command: {
        type: 'room.seat.take',
        seat: 0,
        profile: { displayName: '房主' },
      },
    });

    const actorConflict = await dispatch(stub, {
      commandId: 'bound-command',
      actorUserId: 'player-1',
      command: {
        type: 'room.seat.take',
        seat: 0,
        profile: { displayName: '玩家' },
      },
    });
    const bodyConflict = await dispatch(stub, {
      commandId: 'bound-command',
      actorUserId: 'host-1',
      command: { type: 'room.seat.leave' },
    });

    if (actorConflict.kind !== 'decided') throw new Error(actorConflict.reason);
    if (bodyConflict.kind !== 'decided') throw new Error(bodyConflict.reason);
    expect(actorConflict.result).toEqual({
      kind: 'rejected',
      commandId: 'bound-command',
      reason: REASON_COMMAND_ID_CONFLICT,
    });
    expect(bodyConflict.result).toEqual(actorConflict.result);
  });

  it('persists an engine rejection so changed state cannot turn its retry into an action', async () => {
    const stub = getStub();
    await initialize(stub);
    await dispatch(stub, {
      commandId: 'host-seat',
      actorUserId: 'host-1',
      command: {
        type: 'room.seat.take',
        seat: 0,
        profile: { displayName: '房主' },
      },
    });
    const rejectedRequest = {
      commandId: 'view-empty-bot',
      actorUserId: 'host-1',
      controlledSeat: 2,
      command: { type: 'werewolf.role.view' },
    } as const;

    const first = await dispatch(stub, rejectedRequest);
    if (first.kind !== 'decided') throw new Error(first.reason);
    expect(first.result).toEqual({
      kind: 'rejected',
      commandId: 'view-empty-bot',
      reason: REASON_SEAT_EMPTY,
    });
    await dispatch(stub, {
      commandId: 'fill-bots',
      actorUserId: 'host-1',
      command: { type: 'room.seat.fillBots' },
    });
    await dispatch(stub, {
      commandId: 'assign-roles',
      actorUserId: 'host-1',
      command: { type: 'werewolf.roles.assign' },
    });

    const replay = await dispatch(stub, rejectedRequest);
    expect(replay).toEqual({ kind: 'decided', result: first.result, isReplay: true });
    const snapshot = await stub.getSnapshot();
    if (snapshot === null) throw new Error('Expected initialized snapshot');
    expect(WEREWOLF_STATE_CODEC.parse(snapshot.state).players[2]?.hasViewedRole).toBe(false);
  });

  it('writes the authoritative state and receipt before delivering its platform effect', async () => {
    const stub = getStub();
    await initialize(stub);
    requireCommitted(
      await dispatch(stub, {
        commandId: 'seat-with-effect',
        actorUserId: 'host-1',
        command: {
          type: 'room.seat.take',
          seat: 0,
          profile: { displayName: '房主' },
        },
      }),
    );

    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      const room = state.storage.sql
        .exec('SELECT game_type, state_version, revision FROM room_state WHERE id = 1')
        .one();
      const receipt = state.storage.sql
        .exec(
          `SELECT actor_id, command_type, decision_kind, revision
          FROM command_receipts WHERE command_id = 'seat-with-effect'`,
        )
        .one();
      expect(room).toEqual({ game_type: 'werewolf', state_version: 1, revision: 2 });
      expect(receipt).toEqual({
        actor_id: 'host-1',
        command_type: 'room.seat.take',
        decision_kind: 'committed',
        revision: 2,
      });
    });

    await runDurableObjectAlarm(stub);
    const participant = await env.DB.prepare(
      'SELECT user_id FROM room_participants WHERE room_code = ?',
    )
      .bind(ROOM_CODE)
      .first();
    expect(participant).toEqual({ user_id: 'host-1' });
  });

  it('refuses deletion while any outbox effect remains', async () => {
    const stub = getStub();
    await initialize(stub);
    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      state.storage.sql.exec(`
        INSERT INTO effect_outbox (
          id,
          origin_command_id,
          scope,
          game_type,
          effect_type,
          business_key,
          payload_json,
          status,
          attempt_count,
          available_at,
          created_revision,
          created_at,
          last_error
        ) VALUES (
          'failed-effect',
          'failed-command',
          'platform',
          'werewolf',
          'room.participant.seated',
          'failed-business-key',
          '{}',
          'failed',
          7,
          0,
          1,
          0,
          'delivery exhausted'
        )
      `);
    });

    await expect(stub.deleteRoom('host-1')).resolves.toEqual({
      success: false,
      reason: 'room_effects_pending',
    });
    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      expect(state.storage.sql.exec('SELECT COUNT(*) AS count FROM room_state').one()).toEqual({
        count: 1,
      });
      expect(state.storage.sql.exec('SELECT COUNT(*) AS count FROM effect_outbox').one()).toEqual({
        count: 1,
      });
    });

    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      state.storage.sql.exec("DELETE FROM effect_outbox WHERE id = 'failed-effect'");
    });
    await expect(stub.deleteRoom('host-1')).resolves.toEqual({ success: true });
  });

  it('acknowledges a durable user event only through the socket user identity', async () => {
    const stub = getStub();
    await initialize(stub);
    await enqueueUserEvent(env.DB, {
      userId: 'host-1',
      eventId: 'socket-event',
      message: { type: 'SETTLE_RESULT', eventId: 'socket-event' },
    });

    await runInDurableObject(stub, async (instance: GameRoom, state) => {
      const sockets = new WebSocketPair();
      state.acceptWebSocket(sockets[1], ['user:host-1']);
      await instance.webSocketMessage(
        sockets[1],
        JSON.stringify(createUserEventAckMessage('socket-event')),
      );
    });

    expect(
      await env.DB.prepare(
        "SELECT event_id FROM user_event_inbox WHERE event_id = 'socket-event'",
      ).first(),
    ).toBeNull();
  });

  it('replays the oldest unacknowledged user event when a socket reconnects', async () => {
    const stub = getStub();
    await initialize(stub);
    const message = { type: 'SETTLE_RESULT', eventId: 'offline-event', settlementId: 'game-1' };
    await enqueueUserEvent(env.DB, {
      userId: 'host-1',
      eventId: 'offline-event',
      message,
    });

    const response = await stub.fetch(
      new Request(`https://room.test/websocket?roomCode=${ROOM_CODE}&userId=host-1`, {
        headers: { Upgrade: 'websocket' },
      }),
    );
    expect(response.status).toBe(101);
    const socket = response.webSocket;
    if (socket === null) throw new Error('Expected a WebSocket upgrade response');
    const received = new Promise<unknown>((resolve, reject) => {
      socket.addEventListener('message', (event) => {
        try {
          if (typeof event.data !== 'string') throw new Error('Expected text user event');
          resolve(JSON.parse(event.data));
        } catch (error) {
          if (!(error instanceof Error)) throw error;
          reject(error);
        }
      });
    });
    socket.accept();

    await expect(received).resolves.toEqual(message);
    socket.close();
  });
});
