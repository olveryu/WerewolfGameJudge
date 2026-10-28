/**
 * Realtime wire protocol v2 shared by the Worker room gateway and room clients.
 *
 * Client → server frames: `SYNC` only. The keepalive is the literal text `ping`, answered at the
 * edge by the Durable Object auto-response and never parsed here.
 * Server → client frames: `SYNC_RESULT`, `STATE_UPDATE`, `PRESENCE`, `INBOX_HINT`.
 *
 * Every parser is fail-fast: unknown fields, wrong types and unsupported discriminators throw.
 * Callers that read frames off a socket treat any throw as a protocol error (close 1002).
 */

import {
  type BaseGameState,
  type GameStateCodec,
  parseRoomSnapshot,
  type RoomSnapshot,
} from '../protocol/roomSnapshot';
import {
  failDecode,
  finishObject,
  parseArray,
  parseInteger,
  parseNonEmptyString,
  parseNullable,
  parseObject,
} from '../protocol/runtimeDecoder';

// ─── Client → Server ────────────────────────────────────────────────────────

export interface SyncFrame {
  readonly type: 'SYNC';
  readonly requestId: string;
  /** Revision the client already holds, or null when it has no snapshot yet. */
  readonly knownRevision: number | null;
}

export type ClientFrame = SyncFrame;

// ─── Server → Client ────────────────────────────────────────────────────────

export type SyncResultFrame<TState extends BaseGameState<string>> =
  | {
      readonly type: 'SYNC_RESULT';
      readonly requestId: string;
      readonly outcome: 'current';
      readonly revision: number;
    }
  | {
      readonly type: 'SYNC_RESULT';
      readonly requestId: string;
      readonly outcome: 'snapshot';
      readonly snapshot: RoomSnapshot<TState>;
    };

export interface StateUpdateFrame<TState extends BaseGameState<string>> {
  readonly type: 'STATE_UPDATE';
  readonly snapshot: RoomSnapshot<TState>;
  readonly commandType: string | null;
}

export interface PresenceFrame {
  readonly type: 'PRESENCE';
  readonly onlineUserIds: readonly string[];
}

export interface InboxHintFrame {
  readonly type: 'INBOX_HINT';
}

export type ServerFrame<TState extends BaseGameState<string>> =
  | SyncResultFrame<TState>
  | StateUpdateFrame<TState>
  | PresenceFrame
  | InboxHintFrame;

// ─── Constructors ───────────────────────────────────────────────────────────

function parsePositiveRevision(value: unknown, path: string): number {
  const parsed = parseInteger(value, path);
  if (parsed < 1) return failDecode(path, 'a positive revision');
  return parsed;
}

export function createSyncFrame(requestId: string, knownRevision: number | null): SyncFrame {
  parseNonEmptyString(requestId, 'SyncFrame.requestId');
  if (knownRevision !== null) parsePositiveRevision(knownRevision, 'SyncFrame.knownRevision');
  return { type: 'SYNC', requestId, knownRevision };
}

export function createSyncCurrentFrame<TState extends BaseGameState<string>>(
  requestId: string,
  revision: number,
): SyncResultFrame<TState> {
  parseNonEmptyString(requestId, 'SyncResultFrame.requestId');
  parsePositiveRevision(revision, 'SyncResultFrame.revision');
  return { type: 'SYNC_RESULT', requestId, outcome: 'current', revision };
}

export function createSyncSnapshotFrame<TState extends BaseGameState<string>>(
  requestId: string,
  snapshot: RoomSnapshot<TState>,
): SyncResultFrame<TState> {
  parseNonEmptyString(requestId, 'SyncResultFrame.requestId');
  assertSnapshotIdentity(snapshot);
  return { type: 'SYNC_RESULT', requestId, outcome: 'snapshot', snapshot };
}

export function createStateUpdateFrame<TState extends BaseGameState<string>>(
  snapshot: RoomSnapshot<TState>,
  commandType: string | null,
): StateUpdateFrame<TState> {
  assertSnapshotIdentity(snapshot);
  if (commandType !== null) parseNonEmptyString(commandType, 'StateUpdateFrame.commandType');
  return { type: 'STATE_UPDATE', snapshot, commandType };
}

export function createPresenceFrame(onlineUserIds: Iterable<string>): PresenceFrame {
  const unique = [...new Set(onlineUserIds)].sort();
  for (const userId of unique) parseNonEmptyString(userId, 'PresenceFrame.onlineUserIds[]');
  return { type: 'PRESENCE', onlineUserIds: unique };
}

export const INBOX_HINT_FRAME: InboxHintFrame = Object.freeze({ type: 'INBOX_HINT' });

function assertSnapshotIdentity<TState extends BaseGameState<string>>(
  snapshot: RoomSnapshot<TState>,
): void {
  if (
    snapshot.gameType !== snapshot.state.gameType ||
    snapshot.stateVersion !== snapshot.state.stateVersion
  ) {
    throw new Error('Snapshot identity does not match its state');
  }
}

// ─── Parsers ────────────────────────────────────────────────────────────────

export function parseClientFrame(value: unknown): ClientFrame {
  const raw = parseObject(value, 'ClientFrame');
  if (raw.type !== 'SYNC') {
    return failDecode('ClientFrame.type', 'a supported client frame type');
  }
  return finishObject(
    raw,
    {
      type: 'SYNC' as const,
      requestId: parseNonEmptyString(raw.requestId, 'SyncFrame.requestId'),
      knownRevision: parseNullable(
        raw.knownRevision,
        'SyncFrame.knownRevision',
        parsePositiveRevision,
      ),
    },
    'SyncFrame',
  );
}

export function parseServerFrame<TState extends BaseGameState<string>>(
  value: unknown,
  codec: GameStateCodec<TState>,
): ServerFrame<TState> {
  const raw = parseObject(value, 'ServerFrame');
  switch (raw.type) {
    case 'SYNC_RESULT':
      return parseSyncResultFrame(raw, codec);
    case 'STATE_UPDATE':
      return finishObject(
        raw,
        {
          type: 'STATE_UPDATE' as const,
          snapshot: parseRoomSnapshot(raw.snapshot, codec),
          commandType: parseNullable(
            raw.commandType,
            'StateUpdateFrame.commandType',
            parseNonEmptyString,
          ),
        },
        'StateUpdateFrame',
      );
    case 'PRESENCE': {
      const onlineUserIds = parseArray(
        raw.onlineUserIds,
        'PresenceFrame.onlineUserIds',
        parseNonEmptyString,
      );
      if (new Set(onlineUserIds).size !== onlineUserIds.length) {
        return failDecode('PresenceFrame.onlineUserIds', 'a list of distinct user IDs');
      }
      return finishObject(raw, { type: 'PRESENCE' as const, onlineUserIds }, 'PresenceFrame');
    }
    case 'INBOX_HINT':
      return finishObject(raw, { type: 'INBOX_HINT' as const }, 'InboxHintFrame');
    default:
      return failDecode('ServerFrame.type', 'a supported server frame type');
  }
}

function parseSyncResultFrame<TState extends BaseGameState<string>>(
  raw: Record<string, unknown>,
  codec: GameStateCodec<TState>,
): SyncResultFrame<TState> {
  const requestId = parseNonEmptyString(raw.requestId, 'SyncResultFrame.requestId');
  switch (raw.outcome) {
    case 'current':
      return finishObject(
        raw,
        {
          type: 'SYNC_RESULT' as const,
          requestId,
          outcome: 'current' as const,
          revision: parsePositiveRevision(raw.revision, 'SyncResultFrame.revision'),
        },
        'SyncResultFrame',
      );
    case 'snapshot':
      return finishObject(
        raw,
        {
          type: 'SYNC_RESULT' as const,
          requestId,
          outcome: 'snapshot' as const,
          snapshot: parseRoomSnapshot(raw.snapshot, codec),
        },
        'SyncResultFrame',
      );
    default:
      return failDecode('SyncResultFrame.outcome', "'current' or 'snapshot'");
  }
}
