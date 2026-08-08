/** Generic room Durable Object integration and idempotency contracts. */

import {
  WEREWOLF_STATE_CODEC,
  WEREWOLF_STATE_VERSION,
  type WerewolfPublicCommand,
} from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus } from '@game-judge/game-engine/games/werewolf/public';
import {
  REASON_COMMAND_ID_CONFLICT,
  REASON_NO_STATE,
  REASON_NOT_HOST,
  REASON_SEAT_EMPTY,
} from '@game-judge/game-engine/platform/protocol/reasons';
import { createUserEventAckMessage } from '@game-judge/game-engine/platform/protocol/userEvents';
import { runInDurableObject } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { deleteCurrentRoomAlarms } from '../../../../test/clearRoomAlarms';
import { enqueueUserEvent } from '../../userEvents/inbox';
import type { GameRoomRuntime as GameRoom } from '../GameRoomRuntime';
import { initializeRoomStorage } from '../storageSchema';
import type { DispatchRoomResult, InitializeRoomResult } from '../types';

const ROOM_CODE = '1234';
const TEMPLATE_ROLES = ['wolf', 'seer', 'villager', 'villager'] as const;
const UNSUPPORTED_WEREWOLF_STATE_VERSION = WEREWOLF_STATE_VERSION - 1;

beforeEach(async () => {
  await env.DB.prepare('DELETE FROM user_event_inbox').run();
  await env.DB.prepare('DELETE FROM room_participants').run();
  await env.DB.prepare('DELETE FROM room_game_starts').run();
  await env.DB.prepare('DELETE FROM rooms').run();
  await env.DB.prepare("DELETE FROM users WHERE id IN ('host-1', 'player-1')").run();
  await env.DB.prepare("INSERT INTO users (id) VALUES ('host-1'), ('player-1')").run();
});

afterEach(deleteCurrentRoomAlarms);

function getStub(): DurableObjectStub<GameRoom> {
  return env.GAME_ROOM.get(env.GAME_ROOM.newUniqueId());
}

function roomIdentity(stub: DurableObjectStub<GameRoom>, creationId = 'creation-1') {
  return { roomCode: ROOM_CODE, roomId: stub.id.toString(), creationId };
}

async function ensureDirectory(stub: DurableObjectStub<GameRoom>): Promise<void> {
  await env.DB.prepare(
    `INSERT INTO rooms (
      id, code, game_type, host_user_id, creation_id, config_json, status,
      created_at, updated_at, games_started
    ) VALUES (?, ?, 'werewolf', 'host-1', 'creation-1',
      '{"templateRoles":["wolf","seer","villager","villager"]}', 'active',
      '2026-01-01T00:00:00.000Z', '2026-01-01T00:00:00.000Z', 0)
    ON CONFLICT DO NOTHING`,
  )
    .bind(stub.id.toString(), ROOM_CODE)
    .run();
}

async function initialize(
  stub: DurableObjectStub<GameRoom>,
  creationId = 'creation-1',
): Promise<InitializeRoomResult> {
  await ensureDirectory(stub);
  return stub.initializeRoom({
    ...roomIdentity(stub, creationId),
    gameType: 'werewolf',
    hostUserId: 'host-1',
    config: { templateRoles: TEMPLATE_ROLES },
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
    ...roomIdentity(stub),
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

    await expect(stub.getSnapshot(roomIdentity(stub))).resolves.toBeNull();
    await expect(stub.getRevision(roomIdentity(stub))).resolves.toBeNull();
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

    expect(first).toMatchObject({ success: true, isReplay: false });
    expect(replay).toMatchObject({ success: true, isReplay: true });
    await runInDurableObject(stub, async (instance: GameRoom) => {
      await expect(
        instance.initializeRoom({
          ...roomIdentity(stub, 'creation-2'),
          gameType: 'werewolf',
          hostUserId: 'host-1',
          config: { templateRoles: TEMPLATE_ROLES },
        }),
      ).rejects.toThrow('Room identity does not match Durable Object storage');
    });
    if (!first.success) throw new Error(first.reason);
    const state = WEREWOLF_STATE_CODEC.parse(first.snapshot.state);
    expect(state).toMatchObject({
      gameType: 'werewolf',
      stateVersion: WEREWOLF_STATE_VERSION,
      roomCode: ROOM_CODE,
      hostUserId: 'host-1',
      status: GameStatus.Unseated,
      templateRoles: TEMPLATE_ROLES,
    });
  });

  it('validates the current schema idempotently', async () => {
    const stub = getStub();
    await stub.getSnapshot(roomIdentity(stub));

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
    await stub.getSnapshot(roomIdentity(stub));

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
    await stub.getSnapshot(roomIdentity(stub));

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
    expect(await stub.getRevision(roomIdentity(stub))).toBe(2);
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
    expect(await stub.getRevision(roomIdentity(stub))).toBe(3);
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
    const snapshot = await stub.getSnapshot(roomIdentity(stub));
    if (snapshot === null) throw new Error('Expected initialized snapshot');
    expect(WEREWOLF_STATE_CODEC.parse(snapshot.state).players[2]?.hasViewedRole).toBe(false);
  });

  it('writes the authoritative state and receipt before delivering its platform effect', async () => {
    const stub = getStub();
    await initialize(stub);

    await runInDurableObject(stub, async (instance: GameRoom, state) => {
      requireCommitted(
        await instance.dispatchUserCommand({
          ...roomIdentity(stub),
          commandId: 'seat-with-effect',
          actorUserId: 'host-1',
          controlledSeat: null,
          command: {
            type: 'room.seat.take',
            seat: 0,
            profile: { displayName: '房主' },
          },
        }),
      );
      const room = state.storage.sql
        .exec('SELECT game_type, state_version, revision FROM room_state WHERE id = 1')
        .one();
      const receipt = state.storage.sql
        .exec(
          `SELECT actor_id, command_type, decision_kind, revision
          FROM command_receipts WHERE command_id = 'seat-with-effect'`,
        )
        .one();
      expect(room).toEqual({
        game_type: 'werewolf',
        state_version: WEREWOLF_STATE_VERSION,
        revision: 2,
      });
      expect(receipt).toEqual({
        actor_id: 'host-1',
        command_type: 'room.seat.take',
        decision_kind: 'committed',
        revision: 2,
      });
      expect(
        state.storage.sql
          .exec(
            `SELECT status, effect_type, business_key
            FROM effect_outbox WHERE origin_command_id = 'seat-with-effect'`,
          )
          .one(),
      ).toEqual({
        status: 'pending',
        effect_type: 'platform.room.participantJoined',
        business_key: 'user:host-1',
      });
      await state.storage.deleteAlarm();
    });

    await runInDurableObject(stub, async (instance: GameRoom, state) => {
      await instance.alarm();
      expect(state.storage.sql.exec('SELECT COUNT(*) AS count FROM effect_outbox').one()).toEqual({
        count: 0,
      });
    });
    const participant = await env.DB.prepare(
      'SELECT user_id FROM room_participants WHERE room_id = ?',
    )
      .bind(stub.id.toString())
      .first();
    expect(participant).toEqual({ user_id: 'host-1' });
  });

  it('authorizes and deletes storage whose game state version is no longer supported', async () => {
    const stub = getStub();
    await initialize(stub);
    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      state.storage.sql.exec(
        `UPDATE room_state
        SET state_version = ?, game_state = json_set(game_state, '$.stateVersion', ?)
        WHERE id = 1`,
        UNSUPPORTED_WEREWOLF_STATE_VERSION,
        UNSUPPORTED_WEREWOLF_STATE_VERSION,
      );
    });

    await runInDurableObject(stub, async (instance: GameRoom) => {
      await expect(instance.getSnapshot(roomIdentity(stub))).rejects.toThrow(
        `Unsupported werewolf state version: ${UNSUPPORTED_WEREWOLF_STATE_VERSION}`,
      );
      await expect(
        instance.authorizeRoomDeletion({
          ...roomIdentity(stub, 'wrong-creation'),
          actorUserId: 'host-1',
        }),
      ).rejects.toThrow('Room identity does not match Durable Object storage');
    });
    await expect(
      stub.authorizeRoomDeletion({ ...roomIdentity(stub), actorUserId: 'player-1' }),
    ).resolves.toEqual({ success: false, reason: REASON_NOT_HOST });
    await expect(
      stub.authorizeRoomDeletion({ ...roomIdentity(stub), actorUserId: 'host-1' }),
    ).resolves.toEqual({ success: true });
    await expect(
      stub.deleteRoomStorage({
        ...roomIdentity(stub),
        shouldDiscardFailedEffects: false,
      }),
    ).resolves.toEqual({ success: true });
    await expect(stub.getSnapshot(roomIdentity(stub))).resolves.toBeNull();
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

    await expect(
      stub.authorizeRoomDeletion({ ...roomIdentity(stub), actorUserId: 'host-1' }),
    ).resolves.toEqual({
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
    await expect(
      stub.authorizeRoomDeletion({ ...roomIdentity(stub), actorUserId: 'host-1' }),
    ).resolves.toEqual({ success: true });
    await expect(
      stub.deleteRoomStorage({
        ...roomIdentity(stub),
        shouldDiscardFailedEffects: false,
      }),
    ).resolves.toEqual({ success: true });
    await expect(stub.getSnapshot(roomIdentity(stub))).resolves.toBeNull();
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
      new Request(
        `https://room.test/websocket?roomCode=${ROOM_CODE}&roomId=${encodeURIComponent(
          stub.id.toString(),
        )}&creationId=creation-1&userId=host-1`,
        {
          headers: { Upgrade: 'websocket' },
        },
      ),
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
