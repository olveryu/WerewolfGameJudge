/**
 * Realtime wire protocol v2 shared by the Worker room gateway and room clients.
 *
 * Client → server frames: `SYNC` only. The keepalive is the literal text `ping`, answered at the
 * edge by the Durable Object auto-response and never parsed here.
 * Server → client frames: `SYNC_RESULT`, `STATE_UPDATE`, `PRESENCE`, `INBOX_HINT`.
 *
 * Every parser is fail-fast: unknown fields, wrong types and unsupported discriminators throw
 * {@link RealtimeProtocolError}. Callers that read frames off a socket treat any throw as a
 * protocol error (close 1002). Snapshot payloads are decoded by the game's `GameStateCodec`.
 */

import { z } from 'zod';

import {
  type BaseGameState,
  type GameStateCodec,
  parseRoomSnapshot,
  type RoomSnapshot,
} from '../protocol/roomSnapshot';

/** A frame that violates the realtime wire contract. */
export class RealtimeProtocolError extends Error {
  constructor(label: string, issue: z.ZodError) {
    super(`${label} is malformed:\n${z.prettifyError(issue)}`, { cause: issue });
    this.name = 'RealtimeProtocolError';
  }
}

const requestIdSchema = z.string().min(1);
const revisionSchema = z.number().int().positive();
const userIdSchema = z.string().min(1);
const commandTypeSchema = z.string().min(1).nullable();
const syncResultHeaderSchema = z.strictObject({ requestId: requestIdSchema });

// ─── Client → Server ────────────────────────────────────────────────────────────────────────────

const syncFrameSchema = z.strictObject({
  type: z.literal('SYNC'),
  requestId: requestIdSchema,
  /** Revision the client already holds, or null when it has no snapshot yet. */
  knownRevision: revisionSchema.nullable(),
});

const clientFrameSchema = z.discriminatedUnion('type', [syncFrameSchema]);

export type SyncFrame = z.infer<typeof syncFrameSchema>;
export type ClientFrame = z.infer<typeof clientFrameSchema>;

// ─── Server → Client ────────────────────────────────────────────────────────

const presenceFrameSchema = z.strictObject({
  type: z.literal('PRESENCE'),
  onlineUserIds: z
    .array(userIdSchema)
    .refine((ids) => new Set(ids).size === ids.length, 'user IDs must be distinct'),
});

const inboxHintFrameSchema = z.strictObject({ type: z.literal('INBOX_HINT') });

export type PresenceFrame = z.infer<typeof presenceFrameSchema>;
export type InboxHintFrame = z.infer<typeof inboxHintFrameSchema>;

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

export type ServerFrame<TState extends BaseGameState<string>> =
  | SyncResultFrame<TState>
  | StateUpdateFrame<TState>
  | PresenceFrame
  | InboxHintFrame;

/**
 * Server frame schemas close over the game codec. Building one per parse keeps the schema typed
 * by the caller's codec; the construction cost is negligible next to decoding a snapshot.
 */
function createServerFrameSchema<TState extends BaseGameState<string>>(
  codec: GameStateCodec<TState>,
): z.ZodType<ServerFrame<TState>> {
  const snapshot = z.unknown().transform((value) => parseRoomSnapshot(value, codec));
  const syncResult = z.discriminatedUnion('outcome', [
    z.strictObject({
      type: z.literal('SYNC_RESULT'),
      requestId: requestIdSchema,
      outcome: z.literal('current'),
      revision: revisionSchema,
    }),
    z.strictObject({
      type: z.literal('SYNC_RESULT'),
      requestId: requestIdSchema,
      outcome: z.literal('snapshot'),
      snapshot,
    }),
  ]);
  const stateUpdate = z.strictObject({
    type: z.literal('STATE_UPDATE'),
    snapshot,
    commandType: commandTypeSchema,
  });
  return z.discriminatedUnion('type', [
    syncResult,
    stateUpdate,
    presenceFrameSchema,
    inboxHintFrameSchema,
  ]);
}

// ─── Constructors ───────────────────────────────────────────────────────────

function build<T>(label: string, schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw new RealtimeProtocolError(label, result.error);
  return result.data;
}

export function createSyncFrame(requestId: string, knownRevision: number | null): SyncFrame {
  return build('SyncFrame', syncFrameSchema, { type: 'SYNC', requestId, knownRevision });
}

export function createSyncCurrentFrame<TState extends BaseGameState<string>>(
  requestId: string,
  revision: number,
): SyncResultFrame<TState> {
  build('SyncResultFrame', syncResultHeaderSchema.extend({ revision: revisionSchema }), {
    requestId,
    revision,
  });
  return { type: 'SYNC_RESULT', requestId, outcome: 'current', revision };
}

export function createSyncSnapshotFrame<TState extends BaseGameState<string>>(
  requestId: string,
  snapshot: RoomSnapshot<TState>,
): SyncResultFrame<TState> {
  build('SyncResultFrame', syncResultHeaderSchema, { requestId });
  assertSnapshotIdentity(snapshot);
  return { type: 'SYNC_RESULT', requestId, outcome: 'snapshot', snapshot };
}

export function createStateUpdateFrame<TState extends BaseGameState<string>>(
  snapshot: RoomSnapshot<TState>,
  commandType: string | null,
): StateUpdateFrame<TState> {
  assertSnapshotIdentity(snapshot);
  build('StateUpdateFrame', z.strictObject({ commandType: commandTypeSchema }), { commandType });
  return { type: 'STATE_UPDATE', snapshot, commandType };
}

export function createPresenceFrame(onlineUserIds: Iterable<string>): PresenceFrame {
  return build('PresenceFrame', presenceFrameSchema, {
    type: 'PRESENCE',
    onlineUserIds: [...new Set(onlineUserIds)].sort(),
  });
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
  return build('ClientFrame', clientFrameSchema, value);
}

export function parseServerFrame<TState extends BaseGameState<string>>(
  value: unknown,
  codec: GameStateCodec<TState>,
): ServerFrame<TState> {
  return build('ServerFrame', createServerFrameSchema(codec), value);
}
