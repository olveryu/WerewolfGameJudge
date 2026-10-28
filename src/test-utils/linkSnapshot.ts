/** LinkSnapshot fixtures for consumer tests (room UI, hooks, capabilities). */
import type {
  BaseGameState,
  RoomSnapshot,
} from '@game-judge/game-engine/platform/protocol/roomSnapshot';

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
  readonly presence?: ReadonlySet<string>;
  readonly lastCommand?: { readonly revision: number; readonly type: string } | null;
}

function base(overrides: SnapshotOverrides) {
  return {
    epoch: overrides.epoch ?? 1,
    status: overrides.status ?? LIVE_STATUS,
    lastCommand: overrides.lastCommand ?? null,
    pendingDurableCount: overrides.pendingDurableCount ?? 0,
    presence: overrides.presence ?? new Set<string>(),
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

export type FakeDispatch<TState extends BaseGameState<string>, TCommand extends object> = jest.Mock<
  Promise<DispatchOutcome<TState>>,
  [TCommand, DispatchOptions]
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
  readonly retryNow: jest.Mock<void, []>;
  readonly close: jest.Mock<void, []>;
  readonly connect: jest.Mock<Promise<void>, [RoomIdentity<TState['gameType']>, AbortSignal]>;
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
      ? jest.fn<Promise<DispatchOutcome<TState>>, [TCommand, DispatchOptions]>()
      : jest.fn<Promise<DispatchOutcome<TState>>, [TCommand, DispatchOptions]>(dispatch);
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
    connect: jest.fn<Promise<void>, [RoomIdentity<TState['gameType']>, AbortSignal]>(
      async () => undefined,
    ),
    dispatch: dispatchMock,
    retryNow: jest.fn<void, []>(),
    close: jest.fn<void, []>(),
    publish,
    publishRoom: (room) => {
      if (snapshot.phase !== 'ready') {
        throw new Error('publishRoom requires a ready fake link snapshot');
      }
      publish({ ...snapshot, room });
    },
  };
}
