/**
 * RoomLink contracts — the client-side view of one room connection.
 *
 * `LinkSnapshot` is immutable and `useSyncExternalStore`-friendly. `LinkStatus` is structured:
 * UI never branches on strings, terminal states carry a typed reason, and `waiting` exposes the
 * next retry time so the status bar can count down.
 */
import type { CommittedCommandOutcome } from '@game-judge/game-engine/platform/protocol/commandResult';
import type { GameType } from '@game-judge/game-engine/platform/protocol/gameTypes';
import type {
  BaseGameState,
  RoomSnapshot,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import type { RealtimeCloseReason } from '@game-judge/game-engine/platform/realtime/closeCodes';

import type { RoomRecord } from '@/features/room/model/RoomDirectory';

/** The room directory record plus the authenticated user entering it. */
export interface RoomIdentity<TGameType extends string = GameType> {
  readonly room: RoomRecord<TGameType>;
  readonly userId: string;
}

export type WaitingCause = 'offline' | 'hidden' | 'backoff';

export type LinkStatus =
  | { readonly kind: 'idle' }
  | { readonly kind: 'connecting'; readonly attempt: number }
  | { readonly kind: 'syncing' }
  | { readonly kind: 'live' }
  | {
      readonly kind: 'waiting';
      readonly cause: WaitingCause;
      readonly attempt: number;
      /** Set only for `backoff`; offline/hidden wait for an environment change. */
      readonly nextRetryAtMs: number | null;
    }
  | { readonly kind: 'closed'; readonly reason: RealtimeCloseReason };

/**
 * Entry phase derived from identity, room and status by the link itself:
 * - `idle`: no identity bound.
 * - `entering`: identity bound, no authoritative room snapshot yet.
 * - `ready`: a room snapshot is held (whatever the socket status).
 * - `closed`: the link ended on a terminal reason; the room must be re-entered.
 */
export type LinkPhase = 'idle' | 'entering' | 'ready' | 'closed';

/** Why the link asks the account inbox consumer to read: a server hint or a fresh live socket. */
export type InboxWakeReason = 'hint' | 'live';

/** Platform timer handle; injected so tests can drive time without a global clock. */
export type TimerHandle = ReturnType<typeof setTimeout>;

interface LinkSnapshotBase {
  /** Incremented on every connect(); results bound to an older epoch are discarded. */
  readonly epoch: number;
  readonly status: LinkStatus;
  readonly lastCommand: { readonly revision: number; readonly type: string } | null;
  /** Durable commands persisted locally whose server decision has not arrived. */
  readonly pendingDurableCount: number;
  /** User IDs with an open socket in this room; empty until the first PRESENCE frame. */
  readonly presence: ReadonlySet<string>;
}

export type LinkSnapshot<TState extends BaseGameState<string>> =
  | (LinkSnapshotBase & { readonly phase: 'idle'; readonly identity: null; readonly room: null })
  | (LinkSnapshotBase & {
      readonly phase: 'entering';
      readonly identity: RoomIdentity<TState['gameType']>;
      readonly room: null;
    })
  | (LinkSnapshotBase & {
      readonly phase: 'ready';
      readonly identity: RoomIdentity<TState['gameType']>;
      readonly room: RoomSnapshot<TState>;
    })
  | (LinkSnapshotBase & {
      readonly phase: 'closed';
      readonly identity: RoomIdentity<TState['gameType']>;
      readonly room: RoomSnapshot<TState> | null;
    });

export type ReadyLinkSnapshot<TState extends BaseGameState<string>> = Extract<
  LinkSnapshot<TState>,
  { readonly phase: 'ready' }
>;

export interface DispatchOptions {
  readonly controlledSeat: number | null;
  /** Chinese label used in logs and failure messages. */
  readonly label: string;
  /** Persist locally and replay across connections until the server decides. */
  readonly durable: boolean;
}

/** Immutable envelope for one command; the same commandId is reused on every replay. */
export interface PreparedCommand<TCommand extends object> {
  readonly epoch: number;
  readonly roomCode: string;
  readonly roomId: string;
  readonly commandId: string;
  readonly command: Readonly<TCommand>;
  readonly controlledSeat: number | null;
}

export type DispatchOutcome<TState extends BaseGameState<string>> =
  | {
      readonly kind: 'committed';
      readonly commandId: string;
      readonly snapshot: RoomSnapshot<TState>;
      readonly outcome: CommittedCommandOutcome;
    }
  | { readonly kind: 'rejected'; readonly commandId: string; readonly reason: string }
  /** 404 no_state: the room is gone or not initialised; the intent is kept. */
  | { readonly kind: 'unavailable'; readonly commandId: string }
  /** The request may or may not have reached the server; the intent is kept. */
  | {
      readonly kind: 'undelivered';
      readonly commandId: string;
      readonly cause: 'network' | 'timeout' | 'server' | 'throttled';
    }
  /** The link epoch ended before a decision arrived. */
  | { readonly kind: 'cancelled'; readonly commandId: string };

/** `connect()` rejection: the link ended before (or instead of) becoming live. */
export class RoomLinkClosedError extends Error {
  readonly reason: RealtimeCloseReason;

  constructor(reason: RealtimeCloseReason) {
    super(`Room link closed: ${reason}`);
    this.name = 'RoomLinkClosedError';
    this.reason = reason;
  }
}

export interface RoomLink<TState extends BaseGameState<string>, TCommand extends object> {
  getSnapshot(): LinkSnapshot<TState>;
  subscribe(listener: () => void): () => void;
  /** Resolves on the first live snapshot; rejects with RoomLinkClosedError or the abort reason. */
  connect(identity: RoomIdentity<TState['gameType']>, signal: AbortSignal): Promise<void>;
  dispatch(command: TCommand, options: DispatchOptions): Promise<DispatchOutcome<TState>>;
  /** Reconnect immediately from `waiting`; any other status is a programming error. */
  retryNow(): void;
  /** Release the room: closes the socket, cancels pending work, moves to `closed(released)`. */
  close(): void;
}
