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
import { REALTIME_CLOSE_CODE } from '@game-judge/game-engine/platform/realtime/closeCodes';
import {
  createSyncFrame,
  parseServerFrame,
} from '@game-judge/game-engine/platform/realtime/protocol';
import { runInDurableObject, SELF } from 'cloudflare:test';
import { env } from 'cloudflare:workers';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { deleteCurrentRoomAlarms } from '../../../../test/clearRoomAlarms';
import { initializeRoomStorage } from '../../commands/storageSchema';
import { PRESENCE_SWEEP_INTERVAL_MS } from '../../realtime/RoomGateway';
import { enqueueUserEvent } from '../../userInbox/inbox';
import type { GameRoomRuntime as GameRoom } from '../GameRoomRuntime';
import type { DispatchRoomResult, InitializeRoomResult } from '../types';

const ROOM_CODE = '1234';
const TEMPLATE_ROLES = ['wolf', 'seer', 'villager', 'villager'] as const;
// v5 became a supported migration source with the roster split (v6), so an
// unsupported version must be one no migration path exists for.
// Below the oldest migratable werewolf version (v5): no migration
// path exists, so loading must reject as unsupported.
const UNSUPPORTED_WEREWOLF_STATE_VERSION = 4;

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
      rules: { isSheriffElectionEnabled: true },
    });
  });

  it('validates the current schema idempotently', async () => {
    const stub = getStub();
    await stub.getSnapshot(roomIdentity(stub));

    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      await expect(initializeRoomStorage(state.storage, Date.now())).resolves.toBe('current');
      await expect(initializeRoomStorage(state.storage, Date.now() + 1)).resolves.toBe('current');
      expect(state.storage.sql.exec('SELECT version FROM room_schema').one()).toEqual({
        version: 3,
      });
    });
  });

  it('discards storage created by the migration-chain schema instead of migrating it', async () => {
    const stub = getStub();
    await initialize(stub);
    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      state.storage.sql.exec('DROP TABLE room_schema');
      state.storage.sql.exec(`
        CREATE TABLE _sql_schema_migrations (id INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL) STRICT;
        INSERT INTO _sql_schema_migrations (id, applied_at) VALUES (1, 0), (2, 0);
      `);
      await expect(initializeRoomStorage(state.storage, Date.now())).resolves.toBe('discarded');
      expect(state.storage.sql.exec('SELECT COUNT(*) AS count FROM room_state').one()).toEqual({
        count: 0,
      });
      expect(
        state.storage.sql
          .exec("SELECT name FROM sqlite_master WHERE name = '_sql_schema_migrations'")
          .toArray(),
      ).toEqual([]);
      expect(state.storage.sql.exec('SELECT version FROM room_schema').one()).toEqual({
        version: 3,
      });
    });
  });

  it('requires admin authorization and records an idempotent settlement replay through completion', async () => {
    const stub = getStub();
    await initialize(stub);
    const effectId = 'failed-settlement';
    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      state.storage.sql.exec(
        `INSERT INTO effect_outbox (
        id, origin_command_id, scope, game_type, effect_type, business_key, payload_json,
        status, attempt_count, available_at, created_revision, created_at, last_error
      ) VALUES (?, 'ended', 'game', 'werewolf', 'werewolf.game.ended', 'settlement', ?, 'failed', 7, 0, 1, 0, 'dependency unavailable')`,
        effectId,
        JSON.stringify({
          type: 'werewolf.game.ended',
          payload: {
            roomCode: ROOM_CODE,
            participants: [{ userId: 'host-1', role: 'wolf' }],
          },
        }),
      );
    });
    const command = {
      ...roomIdentity(stub),
      id: crypto.randomUUID(),
      effectId,
      reason: 'dependency repaired',
    };
    const request = (token?: string) =>
      SELF.fetch('https://test.local/admin/effect-replays', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token === undefined ? {} : { 'X-Admin-Token': token }),
        },
        body: JSON.stringify(command),
      });
    expect((await request()).status).toBe(401);
    expect((await request('invalid')).status).toBe(403);
    const token = 'test-admin-token-do-not-use-in-production';
    expect((await request(token)).status).toBe(202);
    await runInDurableObject(stub, async (instance: GameRoom, state) => {
      await instance.alarm();
      const replay = await instance.readEffectReplay(command);
      expect(replay).toMatchObject({
        id: command.id,
        effect_id: effectId,
        reason: command.reason,
        requested_by: 'admin-token',
        status: 'succeeded',
      });
      expect(state.storage.sql.exec('SELECT COUNT(*) AS count FROM effect_outbox').one()).toEqual({
        count: 0,
      });
      await state.storage.deleteAlarm();
    });
    expect((await request(token)).status).toBe(202);
    const response = await SELF.fetch('https://test.local/admin/effect-replays/read', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Admin-Token': token },
      body: JSON.stringify({ ...roomIdentity(stub), id: command.id }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      replay: { id: command.id, status: 'succeeded' },
    });
  });

  it('discards an unversioned room schema and recreates the current one', async () => {
    const stub = getStub();
    await stub.getSnapshot(roomIdentity(stub));

    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
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

      await expect(initializeRoomStorage(state.storage, Date.now())).resolves.toBe('discarded');
      expect(
        state.storage.sql
          .exec<{ name: string }>('PRAGMA table_info(room_state)')
          .toArray()
          .map((column) => column.name),
      ).toContain('initialization_json');
      expect(state.storage.sql.exec('SELECT COUNT(*) AS count FROM room_state').one()).toEqual({
        count: 0,
      });
    });
  });

  it('discards a different room_schema version', async () => {
    const stub = getStub();
    await stub.getSnapshot(roomIdentity(stub));

    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      state.storage.sql.exec('UPDATE room_schema SET version = 99');
      await expect(initializeRoomStorage(state.storage, Date.now())).resolves.toBe('discarded');
      expect(state.storage.sql.exec('SELECT version FROM room_schema').one()).toEqual({
        version: 3,
      });
    });
  });
});

describe('GameRoom command receipts', () => {
  it('replays reordered commands and persisted receipts without changing state', async () => {
    const stub = getStub();
    await initialize(stub);
    const request = {
      commandId: 'reordered-seat',
      actorUserId: 'host-1',
      command: {
        type: 'room.seat.take',
        seat: 0,
        profile: { displayName: 'Host', avatarUrl: 'https://example.com/avatar.png' },
      },
    } as const;
    const first = requireCommitted(await dispatch(stub, request));
    const replay = requireCommitted(
      await dispatch(stub, {
        ...request,
        command: {
          profile: { avatarUrl: 'https://example.com/avatar.png', displayName: 'Host' },
          seat: 0,
          type: 'room.seat.take',
        },
      }),
    );
    expect(replay.isReplay).toBe(true);
    expect(replay.result).toEqual(first.result);

    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      state.storage.sql.exec(
        'UPDATE command_receipts SET request_json = ? WHERE command_id = ?',
        JSON.stringify({
          command: request.command,
          controlledSeat: null,
          actor: { userId: request.actorUserId, kind: 'user' },
        }),
        request.commandId,
      );
    });
    expect(requireCommitted(await dispatch(stub, request))).toEqual(replay);
    expect((await stub.getSnapshot(roomIdentity(stub)))?.revision).toBe(2);
  });

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
    expect(first.result.snapshot.state.roster[0]).toMatchObject({ userId: 'host-1' });
    expect(replay.isReplay).toBe(true);
    expect(replay.result).toEqual(first.result);
    expect((await stub.getSnapshot(roomIdentity(stub)))?.revision).toBe(2);
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
    expect((await stub.getSnapshot(roomIdentity(stub)))?.revision).toBe(3);
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
      command: { type: 'werewolf.role.viewed' },
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
    expect(WEREWOLF_STATE_CODEC.parse(snapshot.state).roleViewedSeats).not.toContain(2);
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

  function acceptTestSocket(state: DurableObjectState, userId: string, connectedAtMs = Date.now()) {
    const sockets = new WebSocketPair();
    // Mirrors RoomGateway.accept(): tag plus attachment, without the presence broadcast.
    state.acceptWebSocket(sockets[1], [`user:${userId}`]);
    sockets[1].serializeAttachment({ userId, connectedAtMs });
    const messages: unknown[] = [];
    const closed = new Promise<{ code: number; reason: string }>((resolve) => {
      sockets[0].addEventListener('close', (event) =>
        resolve({ code: event.code, reason: event.reason }),
      );
    });
    sockets[0].addEventListener('message', (event) => {
      if (typeof event.data !== 'string') throw new Error('Expected text frame');
      messages.push(JSON.parse(event.data));
    });
    sockets[0].accept();
    return { client: sockets[0], server: sockets[1], messages, closed };
  }

  async function settle(): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  it('closes 1002 on a client frame the protocol does not define', async () => {
    const stub = getStub();
    await initialize(stub);

    await runInDurableObject(stub, async (instance: GameRoom, state) => {
      const socket = acceptTestSocket(state, 'host-1');
      await instance.webSocketMessage(
        socket.server,
        JSON.stringify({ type: 'USER_EVENT_ACK', eventId: 'socket-event' }),
      );
      await expect(socket.closed).resolves.toEqual({
        code: REALTIME_CLOSE_CODE.PROTOCOL_ERROR,
        reason: 'protocol_error',
      });
    });
  });

  it('answers SYNC with a snapshot when the client holds no revision', async () => {
    const stub = getStub();
    await initialize(stub);

    await runInDurableObject(stub, async (instance: GameRoom, state) => {
      const socket = acceptTestSocket(state, 'host-1');
      await instance.webSocketMessage(
        socket.server,
        JSON.stringify(createSyncFrame('sync-request-1', null)),
      );
      await settle();
      const frame = parseServerFrame(socket.messages.at(-1), WEREWOLF_STATE_CODEC);
      expect(frame).toMatchObject({
        type: 'SYNC_RESULT',
        requestId: 'sync-request-1',
        outcome: 'snapshot',
        snapshot: { revision: 1 },
      });
      socket.client.close();
    });
  });

  it('answers SYNC with current when the client already holds the latest revision', async () => {
    const stub = getStub();
    await initialize(stub);

    await runInDurableObject(stub, async (instance: GameRoom, state) => {
      const socket = acceptTestSocket(state, 'host-1');
      await instance.webSocketMessage(
        socket.server,
        JSON.stringify(createSyncFrame('sync-request-2', 1)),
      );
      await settle();
      expect(parseServerFrame(socket.messages.at(-1), WEREWOLF_STATE_CODEC)).toEqual({
        type: 'SYNC_RESULT',
        requestId: 'sync-request-2',
        outcome: 'current',
        revision: 1,
      });
      socket.client.close();
    });
  });

  it('closes with 4003 when an initialized room has no authoritative snapshot', async () => {
    const stub = getStub();
    await initialize(stub);

    await runInDurableObject(stub, async (instance: GameRoom, state) => {
      state.storage.sql.exec('DELETE FROM room_state');
      const socket = acceptTestSocket(state, 'host-1');
      await instance.webSocketMessage(
        socket.server,
        JSON.stringify(createSyncFrame('missing-snapshot-request', null)),
      );
      await expect(socket.closed).resolves.toEqual({
        code: REALTIME_CLOSE_CODE.STATE_UNAVAILABLE,
        reason: 'state_unavailable',
      });
    });
  });

  it('publishes PRESENCE on admission, arms the sweep alarm and answers SYNC', async () => {
    const stub = getStub();
    await initialize(stub);
    await enqueueUserEvent(env.DB, {
      userId: 'host-1',
      eventId: 'offline-event',
      message: { type: 'SETTLE_RESULT', eventId: 'offline-event', settlementId: 'game-1' },
    });

    const acceptedAt = Date.now();
    const response = await stub.fetch(
      new Request(
        `https://room.test/websocket?roomCode=${ROOM_CODE}&roomId=${encodeURIComponent(
          stub.id.toString(),
        )}&creationId=creation-1&userId=host-1`,
        { headers: { Upgrade: 'websocket' } },
      ),
    );
    expect(response.status).toBe(101);
    const socket = response.webSocket;
    if (socket === null) throw new Error('Expected a WebSocket upgrade response');
    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      const alarmAt = await state.storage.getAlarm();
      if (alarmAt === null) throw new Error('Expected the sweep alarm to be armed on accept');
      expect(alarmAt).toBeGreaterThanOrEqual(acceptedAt + PRESENCE_SWEEP_INTERVAL_MS);
      expect(alarmAt).toBeLessThanOrEqual(Date.now() + PRESENCE_SWEEP_INTERVAL_MS);
    });
    const frames: unknown[] = [];
    const received = (count: number) =>
      new Promise<void>((resolve) => {
        const check = () => {
          if (frames.length >= count) resolve();
        };
        socket.addEventListener('message', (event) => {
          if (typeof event.data !== 'string') throw new Error('Expected text frame');
          frames.push(JSON.parse(event.data));
          check();
        });
        check();
      });
    socket.accept();

    socket.send(JSON.stringify(createSyncFrame('account-independent-sync', null)));
    await received(2);
    const parsed = frames.map((frame) => parseServerFrame(frame, WEREWOLF_STATE_CODEC));
    expect(parsed[0]).toEqual({ type: 'PRESENCE', onlineUserIds: ['host-1'] });
    expect(parsed[1]).toMatchObject({
      type: 'SYNC_RESULT',
      requestId: 'account-independent-sync',
      outcome: 'snapshot',
      snapshot: { revision: 1 },
    });
    // The inbox row stays untouched: account events travel over HTTP, never the room socket.
    expect(
      await env.DB.prepare(
        "SELECT event_id FROM user_event_inbox WHERE event_id = 'offline-event'",
      ).first(),
    ).not.toBeNull();
    socket.close();
  });

  function admissionRequest(stub: DurableObjectStub<GameRoom>): Request {
    return new Request(
      `https://room.test/websocket?roomCode=${ROOM_CODE}&roomId=${encodeURIComponent(
        stub.id.toString(),
      )}&creationId=creation-1&userId=host-1`,
      { headers: { Upgrade: 'websocket' } },
    );
  }

  async function admissionClose(response: Response): Promise<{ code: number; reason: string }> {
    expect(response.status).toBe(101);
    const socket = response.webSocket;
    if (socket === null) throw new Error('Expected a WebSocket upgrade response');
    const closed = new Promise<{ code: number; reason: string }>((resolve) => {
      socket.addEventListener('close', (event) =>
        resolve({ code: event.code, reason: event.reason }),
      );
    });
    socket.accept();
    return closed;
  }

  it('closes every socket with 4000 when the room storage is deleted and disarms the alarm', async () => {
    const stub = getStub();
    await initialize(stub);
    const closed = admissionClose(await stub.fetch(admissionRequest(stub)));
    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      expect(await state.storage.getAlarm()).not.toBeNull();
    });

    await expect(
      stub.deleteRoomStorage({ ...roomIdentity(stub), shouldDiscardFailedEffects: false }),
    ).resolves.toEqual({ success: true });
    await expect(closed).resolves.toEqual({
      code: REALTIME_CLOSE_CODE.ROOM_DELETED,
      reason: 'room_deleted',
    });
    await runInDurableObject(stub, async (_instance: GameRoom, state) => {
      expect(await state.storage.getAlarm()).toBeNull();
    });
    // A late admission after deletion is terminal too, never an opaque 1006.
    await expect(admissionClose(await stub.fetch(admissionRequest(stub)))).resolves.toEqual({
      code: REALTIME_CLOSE_CODE.ROOM_DELETED,
      reason: 'room_deleted',
    });
  });

  it('closes 4003 when the directory points at an object that holds no state for the instance', async () => {
    const stub = getStub();
    // Never initialized: the same object a discarded-schema room ends up as.
    await expect(admissionClose(await stub.fetch(admissionRequest(stub)))).resolves.toEqual({
      code: REALTIME_CLOSE_CODE.STATE_UNAVAILABLE,
      reason: 'state_unavailable',
    });
  });

  it('sweep closes a socket with no keepalive for 60s and publishes the shrunken presence', async () => {
    const stub = getStub();
    await initialize(stub);

    await runInDurableObject(stub, async (instance: GameRoom, state) => {
      const host = acceptTestSocket(state, 'host-1');
      const stale = acceptTestSocket(state, 'player-1', Date.now() - 61_000);

      await instance.alarm();
      await settle();

      await expect(stale.closed).resolves.toEqual({ code: 1001, reason: 'keepalive_timeout' });
      expect(host.messages).toEqual([{ type: 'PRESENCE', onlineUserIds: ['host-1'] }]);
      // The surviving socket keeps the sweep armed.
      const alarmAt = await state.storage.getAlarm();
      if (alarmAt === null) throw new Error('Expected the sweep alarm to stay armed');
      expect(alarmAt).toBeLessThanOrEqual(Date.now() + PRESENCE_SWEEP_INTERVAL_MS);

      // Unchanged set: the next sweep stays silent.
      await instance.alarm();
      await settle();
      expect(host.messages).toHaveLength(1);
      host.client.close();
    });
  });

  it('sweep disarms the alarm once no open socket remains and the outbox is empty', async () => {
    const stub = getStub();
    await initialize(stub);

    await runInDurableObject(stub, async (instance: GameRoom, state) => {
      const stale = acceptTestSocket(state, 'player-1', Date.now() - 61_000);
      await instance.alarm();
      await expect(stale.closed).resolves.toEqual({ code: 1001, reason: 'keepalive_timeout' });
      expect(await state.storage.getAlarm()).toBeNull();
    });
  });
});
