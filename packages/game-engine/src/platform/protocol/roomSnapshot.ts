/** Shared state identity and snapshot envelopes for room runtimes. */

import type { GameType } from './gameTypes';

export interface BaseGameState<TGameType extends string> {
  readonly gameType: TGameType;
  readonly stateVersion: number;
  readonly roomCode: string;
  readonly hostUserId: string;
}

export interface GameStateIdentity<TGameType extends string = GameType> {
  readonly gameType: TGameType;
  readonly stateVersion: number;
}

export interface GameStateCodec<TState extends BaseGameState<string>> extends GameStateIdentity<
  TState['gameType']
> {
  parse(value: unknown): TState;
}

export interface RoomSnapshot<TState extends BaseGameState<string>> {
  readonly gameType: TState['gameType'];
  readonly stateVersion: number;
  readonly revision: number;
  readonly state: TState;
}

export interface StateUpdateMessage<
  TState extends BaseGameState<string>,
> extends RoomSnapshot<TState> {
  readonly type: 'STATE_UPDATE';
  readonly lastCommandType: string | null;
}

export interface StateSyncRequestMessage {
  readonly type: 'STATE_SYNC_REQUEST';
  readonly requestId: string;
}

export interface StateSyncResponseMessage<
  TState extends BaseGameState<string>,
> extends RoomSnapshot<TState> {
  readonly type: 'STATE_SYNC_RESPONSE';
  readonly requestId: string;
}

function assertPositiveVersion(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function parsePositiveVersion(value: unknown, label: string): number {
  if (typeof value !== 'number') {
    throw new Error(`${label} must be a positive safe integer`);
  }
  assertPositiveVersion(value, label);
  return value;
}

function parseNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function assertExactKeys(
  value: Record<string, unknown>,
  expectedKeys: readonly string[],
  label: string,
): void {
  const expected = new Set(expectedKeys);
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) {
      throw new Error(`${label} contains unknown field: ${key}`);
    }
  }
  for (const key of expectedKeys) {
    if (!(key in value)) {
      throw new Error(`${label} is missing field: ${key}`);
    }
  }
}

export function createRoomSnapshot<TState extends BaseGameState<string>>(
  state: TState,
  revision: number,
): RoomSnapshot<TState> {
  assertPositiveVersion(state.stateVersion, 'stateVersion');
  assertPositiveVersion(revision, 'revision');
  return {
    gameType: state.gameType,
    stateVersion: state.stateVersion,
    revision,
    state,
  };
}

export function createStateUpdateMessage<TState extends BaseGameState<string>>(
  snapshot: RoomSnapshot<TState>,
  lastCommandType: string | null,
): StateUpdateMessage<TState> {
  if (
    snapshot.gameType !== snapshot.state.gameType ||
    snapshot.stateVersion !== snapshot.state.stateVersion
  ) {
    throw new Error('Snapshot identity does not match its state');
  }
  return {
    type: 'STATE_UPDATE',
    ...snapshot,
    lastCommandType,
  };
}

export function createStateSyncRequestMessage(requestId: string): StateSyncRequestMessage {
  return {
    type: 'STATE_SYNC_REQUEST',
    requestId: parseNonEmptyString(requestId, 'requestId'),
  };
}

export function createStateSyncResponseMessage<TState extends BaseGameState<string>>(
  requestId: string,
  snapshot: RoomSnapshot<TState>,
): StateSyncResponseMessage<TState> {
  if (
    snapshot.gameType !== snapshot.state.gameType ||
    snapshot.stateVersion !== snapshot.state.stateVersion
  ) {
    throw new Error('Snapshot identity does not match its state');
  }
  return {
    type: 'STATE_SYNC_RESPONSE',
    requestId: parseNonEmptyString(requestId, 'requestId'),
    ...snapshot,
  };
}

export function parseRoomSnapshot<TState extends BaseGameState<string>>(
  value: unknown,
  codec: GameStateCodec<TState>,
): RoomSnapshot<TState> {
  const raw = parseRecord(value, 'RoomSnapshot');
  assertExactKeys(raw, ['gameType', 'stateVersion', 'revision', 'state'], 'RoomSnapshot');
  if (raw.gameType !== codec.gameType) {
    throw new Error(`Unexpected snapshot game type: ${String(raw.gameType)}`);
  }
  const stateVersion = parsePositiveVersion(raw.stateVersion, 'stateVersion');
  if (stateVersion !== codec.stateVersion) {
    throw new Error(`Unsupported snapshot state version: ${stateVersion}`);
  }
  const snapshot = {
    gameType: codec.gameType,
    stateVersion,
    revision: parsePositiveVersion(raw.revision, 'revision'),
    state: codec.parse(raw.state),
  };
  assertRoomSnapshotIdentity(snapshot, codec);
  return snapshot;
}

export function parseStateUpdateMessage<TState extends BaseGameState<string>>(
  value: unknown,
  codec: GameStateCodec<TState>,
): StateUpdateMessage<TState> {
  const raw = parseRecord(value, 'StateUpdateMessage');
  assertExactKeys(
    raw,
    ['type', 'gameType', 'stateVersion', 'revision', 'state', 'lastCommandType'],
    'StateUpdateMessage',
  );
  if (raw.type !== 'STATE_UPDATE') {
    throw new Error(`Unexpected realtime message type: ${String(raw.type)}`);
  }
  if (raw.lastCommandType !== null && typeof raw.lastCommandType !== 'string') {
    throw new Error('lastCommandType must be a string or null');
  }
  const snapshot = parseRoomSnapshot(
    {
      gameType: raw.gameType,
      stateVersion: raw.stateVersion,
      revision: raw.revision,
      state: raw.state,
    },
    codec,
  );
  return {
    type: 'STATE_UPDATE',
    ...snapshot,
    lastCommandType: raw.lastCommandType,
  };
}

export function parseStateSyncRequestMessage(value: unknown): StateSyncRequestMessage {
  const raw = parseRecord(value, 'StateSyncRequestMessage');
  assertExactKeys(raw, ['type', 'requestId'], 'StateSyncRequestMessage');
  if (raw.type !== 'STATE_SYNC_REQUEST') {
    throw new Error(`Unexpected state sync request type: ${String(raw.type)}`);
  }
  return {
    type: raw.type,
    requestId: parseNonEmptyString(raw.requestId, 'requestId'),
  };
}

export function parseStateSyncResponseMessage<TState extends BaseGameState<string>>(
  value: unknown,
  codec: GameStateCodec<TState>,
): StateSyncResponseMessage<TState> {
  const raw = parseRecord(value, 'StateSyncResponseMessage');
  assertExactKeys(
    raw,
    ['type', 'requestId', 'gameType', 'stateVersion', 'revision', 'state'],
    'StateSyncResponseMessage',
  );
  if (raw.type !== 'STATE_SYNC_RESPONSE') {
    throw new Error(`Unexpected state sync response type: ${String(raw.type)}`);
  }
  const snapshot = parseRoomSnapshot(
    {
      gameType: raw.gameType,
      stateVersion: raw.stateVersion,
      revision: raw.revision,
      state: raw.state,
    },
    codec,
  );
  return {
    type: raw.type,
    requestId: parseNonEmptyString(raw.requestId, 'requestId'),
    ...snapshot,
  };
}

export function assertRoomSnapshotIdentity<TState extends BaseGameState<string>>(
  snapshot: RoomSnapshot<TState>,
  expected: GameStateIdentity<TState['gameType']>,
): void {
  assertPositiveVersion(snapshot.revision, 'revision');
  if (snapshot.gameType !== expected.gameType || snapshot.state.gameType !== expected.gameType) {
    throw new Error(`Unexpected snapshot game type: ${snapshot.gameType}`);
  }
  if (
    snapshot.stateVersion !== expected.stateVersion ||
    snapshot.state.stateVersion !== expected.stateVersion
  ) {
    throw new Error(`Unsupported snapshot state version: ${snapshot.stateVersion}`);
  }
}
