import type {
  GameRoomAccountSnapshot,
  RoomAccountCapability,
} from '@/features/room/model/RoomAccountCapability';
import { createActiveRoomAccountSource, type LoadedRoomAccounts } from '@/games/activeRoomAccount';
import { successfulRoomCommand, testRoomState } from '@/test-utils/roomCommand';

function createCapability(snapshot: GameRoomAccountSnapshot): RoomAccountCapability {
  return {
    gameType: snapshot.gameType,
    getSnapshot: () => snapshot,
    subscribe: () => () => {},
    updateProfile: async () =>
      successfulRoomCommand(testRoomState(snapshot.gameType), 'account-profile'),
    leaveSeat: async () => successfulRoomCommand(testRoomState(snapshot.gameType), 'account-leave'),
  };
}

function loaded(
  capabilities: RoomAccountCapability[],
): LoadedRoomAccounts & { add(c: RoomAccountCapability): void } {
  const listeners = new Set<() => void>();
  return {
    current: () => capabilities,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    add: (capability) => {
      capabilities.push(capability);
      for (const listener of listeners) listener();
    },
  };
}

const READY_SEATED: GameRoomAccountSnapshot = {
  gameType: 'demo',
  phase: 'ready',
  isSeated: true,
  canSwitchAccount: false,
  canSyncProfile: true,
};

describe('createActiveRoomAccountSource', () => {
  it('returns one stable idle snapshot while no loaded game is in a room', () => {
    const source = createActiveRoomAccountSource(
      loaded([
        createCapability({
          gameType: 'demo',
          phase: 'idle',
          isSeated: false,
          canSwitchAccount: true,
          canSyncProfile: false,
        }),
      ]),
    );

    expect(source.getSnapshot()).toBe(source.getSnapshot());
    expect(source.getSnapshot()).toEqual({
      phase: 'idle',
      isSeated: false,
      canSwitchAccount: true,
      canSyncProfile: false,
    });
  });

  it('exposes the active capability without game-specific state', async () => {
    const updateProfile = vi.fn(async () =>
      successfulRoomCommand(testRoomState('demo'), 'active-profile'),
    );
    const source = createActiveRoomAccountSource(
      loaded([{ ...createCapability(READY_SEATED), updateProfile }]),
    );
    const snapshot = source.getSnapshot();

    if (snapshot.phase === 'idle') throw new Error('Expected active room account');
    await snapshot.updateProfile({ displayName: 'Alice' });
    expect(updateProfile).toHaveBeenCalledWith({ displayName: 'Alice' });
  });

  it('notifies and subscribes to a module that loads after subscription', () => {
    const accounts = loaded([]);
    const source = createActiveRoomAccountSource(accounts);
    const listener = vi.fn();
    const subscribe = vi.fn(() => () => {});
    source.subscribe(listener);

    accounts.add({ ...createCapability(READY_SEATED), subscribe });

    expect(listener).toHaveBeenCalledTimes(1);
    expect(subscribe).toHaveBeenCalledWith(listener);
    expect(source.getSnapshot().phase).toBe('ready');
  });

  it('fails fast when two game sessions are active', () => {
    const active = createCapability({ ...READY_SEATED, phase: 'entering' });
    const source = createActiveRoomAccountSource(loaded([active, active]));

    expect(() => source.getSnapshot()).toThrow(
      '[FAIL-FAST] More than one game room session is active',
    );
  });
});
