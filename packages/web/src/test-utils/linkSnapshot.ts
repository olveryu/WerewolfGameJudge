/** LinkSnapshot fixtures for consumer tests (room UI, hooks, capabilities). */
import type {
  BaseGameState,
  RoomSnapshot,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';
import type { Mock } from 'vitest';

import type {
  DispatchOptions,
  DispatchOutcome,
  LinkSnapshot,
  LinkStatus,
  ReadyLinkSnapshot,
  RoomIdentity,
  RoomLink,
} from '@/platform/realtime/types';

const LIVE_STATUS: LinkStatus = { kind: 'live' };

interface SnapshotOverrides {
  readonly status?: LinkStatus;
  readonly epoch?: number;
  readonly pendingDurableCount?: number;
  readonly lastCommand?: { readonly revision: number; readonly type: string } | null;
}

function base(overrides: SnapshotOverrides) {
  return {
    epoch: overrides.epoch ?? 1,
    status: overrides.status ?? LIVE_STATUS,
    lastCommand: overrides.lastCommand ?? null,
    pendingDurableCount: overrides.pendingDurableCount ?? 0,
  };
}

export function idleLinkSnapshot<TState extends BaseGameState<string>>(
  overrides: SnapshotOverrides = {},
): LinkSnapshot<TState> {
  return {
    ...base({ epoch: 0, status: { kind: 'idle' }, ...overrides }),
    phase: 'idle',
    identity: null,
    room: null,
  };
}

export function enteringLinkSnapshot<TState extends BaseGameState<string>>(
  identity: RoomIdentity<TState['gameType']>,
  overrides: SnapshotOverrides = {},
): LinkSnapshot<TState> {
  return {
    ...base({ status: { kind: 'connecting', attempt: 1 }, ...overrides }),
    phase: 'entering',
    identity,
    room: null,
  };
}

export function readyLinkSnapshot<TState extends BaseGameState<string>>(
  identity: RoomIdentity<TState['gameType']>,
  room: RoomSnapshot<TState>,
  overrides: SnapshotOverrides = {},
): ReadyLinkSnapshot<TState> {
  return { ...base(overrides), phase: 'ready', identity, room };
}

/** Directory record + user for a test room; `createdAt` is fixed so fixtures stay deterministic. */
export function testIdentity<TGameType extends string>(
  gameType: TGameType,
  overrides: { roomCode?: string; roomId?: string; hostUserId?: string; userId?: string } = {},
): RoomIdentity<TGameType> {
  return {
    room: {
      roomCode: overrides.roomCode ?? '1234',
      roomId: overrides.roomId ?? 'room-1234',
      gameType,
      hostUserId: overrides.hostUserId ?? 'host',
      createdAt: new Date('2026-01-01T00:00:00.000Z'),
    },
    userId: overrides.userId ?? overrides.hostUserId ?? 'host',
  };
}

export type FakeDispatch<TState extends BaseGameState<string>, TCommand extends object> = Mock<
  (...args: [TCommand, DispatchOptions]) => Promise<DispatchOutcome<TState>>
>;

/**
 * In-memory RoomLink whose snapshot can be replaced mid-test; replacing notifies subscribers the
 * way the production link does. `dispatch` is a jest mock the test scripts per scenario.
 */
export interface FakeRoomLink<
  TState extends BaseGameState<string>,
  TCommand extends object,
> extends RoomLink<TState, TCommand> {
  readonly dispatch: FakeDispatch<TState, TCommand>;
  readonly retryNow: Mock<(...args: []) => void>;
  readonly close: Mock<(...args: []) => void>;
  readonly connect: Mock<
    (...args: [RoomIdentity<TState['gameType']>, AbortSignal]) => Promise<void>
  >;
  /** Replace the snapshot and notify subscribers. */
  publish(next: LinkSnapshot<TState>): void;
  /** Replace only the room snapshot of a ready link, bumping the revision. */
  publishRoom(room: RoomSnapshot<TState>): void;
}

/**
 * @param dispatch - implementation for the dispatch mock; defaults to an unscripted mock that
 *   returns undefined (tests that dispatch must script it).
 */
export function createFakeRoomLink<TState extends BaseGameState<string>, TCommand extends object>(
  initial: LinkSnapshot<TState>,
  dispatch?: (command: TCommand, options: DispatchOptions) => Promise<DispatchOutcome<TState>>,
): FakeRoomLink<TState, TCommand> {
  const dispatchMock: FakeDispatch<TState, TCommand> =
    dispatch === undefined
      ? vi.fn<(...args: [TCommand, DispatchOptions]) => Promise<DispatchOutcome<TState>>>()
      : vi.fn<(...args: [TCommand, DispatchOptions]) => Promise<DispatchOutcome<TState>>>(dispatch);
  let snapshot = initial;
  const listeners = new Set<() => void>();
  const publish = (next: LinkSnapshot<TState>): void => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    connect: vi.fn<(...args: [RoomIdentity<TState['gameType']>, AbortSignal]) => Promise<void>>(
      async () => undefined,
    ),
    dispatch: dispatchMock,
    retryNow: vi.fn<(...args: []) => void>(),
    close: vi.fn<(...args: []) => void>(),
    publish,
    publishRoom: (room) => {
      if (snapshot.phase !== 'ready') {
        throw new Error('publishRoom requires a ready fake link snapshot');
      }
      publish({ ...snapshot, room });
    },
  };
}
