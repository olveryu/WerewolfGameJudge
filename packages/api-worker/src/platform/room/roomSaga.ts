/** Forward-recoverable orchestration between the D1 directory and room Durable Objects. */

import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type { BaseGameState } from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import * as Sentry from '@sentry/cloudflare';

import type { Env } from '../../env';
import { createLogger } from '../observability/logger';
import {
  activateRoomCreation,
  deleteRoomDirectoryEntry,
  listRoomsForReconciliation,
  recordRoomSagaFailure,
  type RoomDirectoryRecord,
} from './roomDirectory';
import { getGameRoomStub } from './roomStub';
import type { InitializeRoomResult } from './types';

const ROOM_RECONCILIATION_BATCH_SIZE = 100;

const log = createLogger('room-saga');

export interface InitializedDirectoryRoom {
  readonly room: RoomDirectoryRecord;
  readonly snapshot: Extract<InitializeRoomResult, { success: true }>['snapshot'];
}

export type ResumedRoomDeletion =
  | { readonly kind: 'deleted' }
  | { readonly kind: 'blocked'; readonly reason: string };

function parseCanonicalConfig(room: RoomDirectoryRecord): unknown {
  const config: unknown = JSON.parse(room.configJson);
  if (typeof config !== 'object' || config === null || Array.isArray(config)) {
    throw new Error(`Room ${room.code} config_json must contain an object`);
  }
  return config;
}

function assertInitializedIdentity(
  room: RoomDirectoryRecord,
  state: BaseGameState<GameType>,
): void {
  if (
    state.roomCode !== room.code ||
    state.gameType !== room.gameType ||
    state.hostUserId !== room.hostUserId
  ) {
    throw new Error(`Room ${room.code} initialized with mismatched authoritative identity`);
  }
}

function assertCreationStatus(room: RoomDirectoryRecord): void {
  if (
    room.status === 'deleting' ||
    (room.status === 'failed' && room.failureOperation !== 'create')
  ) {
    throw new Error(`Room creation ${room.creationId} cannot resume from ${room.status}`);
  }
}

function assertDeletionStatus(room: RoomDirectoryRecord): void {
  if (
    room.status !== 'deleting' &&
    !(room.status === 'failed' && room.failureOperation === 'delete')
  ) {
    throw new Error(`Room deletion ${room.creationId} cannot resume from ${room.status}`);
  }
}

/** Initialize or replay the exact creation request, then activate its directory row. */
export async function resumeRoomCreation(
  env: Env,
  room: RoomDirectoryRecord,
  nowMs: number,
  request?: Request,
): Promise<InitializedDirectoryRoom> {
  assertCreationStatus(room);
  const stub = getGameRoomStub(env, room.id, request);
  const initialized = await stub.initializeRoom({
    roomCode: room.code,
    roomId: room.id,
    gameType: room.gameType,
    hostUserId: room.hostUserId,
    config: parseCanonicalConfig(room),
    creationId: room.creationId,
  });
  if (!initialized.success) {
    throw new Error(`Room ${room.code} initialization rejected: ${initialized.reason}`);
  }
  assertInitializedIdentity(room, initialized.snapshot.state);
  const activeRoom = room.status === 'active' ? room : await activateRoomCreation(env, room, nowMs);
  return { room: activeRoom, snapshot: initialized.snapshot };
}

/** Delete exact DO storage first, then remove only the matching deleting directory row. */
export async function resumeRoomDeletion(
  env: Env,
  room: RoomDirectoryRecord,
): Promise<ResumedRoomDeletion> {
  assertDeletionStatus(room);
  const deleted = await getGameRoomStub(env, room.id).deleteRoomStorage({
    roomCode: room.code,
    roomId: room.id,
    creationId: room.creationId,
  });
  if (!deleted.success) {
    return { kind: 'blocked', reason: deleted.reason };
  }
  await deleteRoomDirectoryEntry(env, room);
  return { kind: 'deleted' };
}

async function reconcileOneRoom(env: Env, room: RoomDirectoryRecord, nowMs: number): Promise<void> {
  const operation =
    room.status === 'creating'
      ? 'create'
      : room.status === 'deleting'
        ? 'delete'
        : room.failureOperation;
  if (operation === null) {
    throw new Error(`Failed room ${room.code} has no saga operation`);
  }

  try {
    if (operation === 'create') {
      await resumeRoomCreation(env, room, nowMs);
    } else {
      const deletion = await resumeRoomDeletion(env, room);
      if (deletion.kind === 'blocked') {
        throw new Error(`Room ${room.code} deletion blocked: ${deletion.reason}`);
      }
    }
  } catch (error) {
    const cause = error instanceof Error ? error : new Error(String(error));
    await recordRoomSagaFailure(env, room, operation, cause, nowMs);
    throw cause;
  }
}

/** Reconcile every due room independently, then surface all failures to the scheduled event. */
export async function reconcileRoomDirectory(env: Env, nowMs: number): Promise<number> {
  const dueRooms = await listRoomsForReconciliation(env, nowMs, ROOM_RECONCILIATION_BATCH_SIZE);
  const failures: Error[] = [];
  let reconciled = 0;

  for (const room of dueRooms) {
    try {
      await reconcileOneRoom(env, room, nowMs);
      reconciled += 1;
    } catch (error) {
      const cause = error instanceof Error ? error : new Error(String(error));
      failures.push(cause);
      log.error('room reconciliation failed', {
        roomCode: room.code,
        creationId: room.creationId,
        status: room.status,
        error: cause.message,
      });
      Sentry.captureException(cause, {
        tags: { roomStatus: room.status, gameType: room.gameType },
        extra: { roomCode: room.code, creationId: room.creationId },
      });
    }
  }

  if (failures.length > 0) {
    throw new AggregateError(failures, `${failures.length} room saga reconciliation failures`);
  }
  return reconciled;
}
