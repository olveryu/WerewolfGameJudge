/**
 * Resolves the one active room account across the client game modules loaded so far. A game
 * whose chunk has not loaded has no room link, so it can never hold the active room.
 */

import type {
  ActiveRoomAccountSnapshot,
  GameRoomAccountSnapshot,
  RoomAccountCapability,
} from '@/features/room/model/RoomAccountCapability';

const IDLE_SNAPSHOT: ActiveRoomAccountSnapshot = Object.freeze({
  phase: 'idle',
  isSeated: false,
  canSwitchAccount: true,
  canSyncProfile: false,
});

/** The room account capabilities of the loaded game modules; the list only grows. */
export interface LoadedRoomAccounts {
  readonly current: () => readonly RoomAccountCapability[];
  /** Called after a game module loads and its capability joins `current()`. */
  readonly subscribe: (listener: () => void) => () => void;
}

export interface ActiveRoomAccountSource {
  readonly getSnapshot: () => ActiveRoomAccountSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
}

export function createActiveRoomAccountSource(
  accounts: LoadedRoomAccounts,
): ActiveRoomAccountSource {
  let lastCapability: RoomAccountCapability | null = null;
  let lastGameSnapshot: GameRoomAccountSnapshot | null = null;
  let lastSnapshot = IDLE_SNAPSHOT;

  const getSnapshot = (): ActiveRoomAccountSnapshot => {
    const active = accounts
      .current()
      .map((capability) => ({ capability, snapshot: capability.getSnapshot() }))
      .filter(({ snapshot }) => snapshot.phase !== 'idle');

    if (active.length > 1) {
      throw new Error('[FAIL-FAST] More than one game room session is active');
    }
    const current = active[0];
    if (current === undefined) {
      lastCapability = null;
      lastGameSnapshot = null;
      lastSnapshot = IDLE_SNAPSHOT;
      return lastSnapshot;
    }
    if (current.snapshot.phase === 'idle') {
      throw new Error('[FAIL-FAST] Active room resolver selected an idle capability');
    }
    if (current.snapshot.gameType !== current.capability.gameType) {
      throw new Error('[FAIL-FAST] Room account capability game type mismatch');
    }
    if (current.capability === lastCapability && current.snapshot === lastGameSnapshot) {
      return lastSnapshot;
    }

    lastCapability = current.capability;
    lastGameSnapshot = current.snapshot;
    lastSnapshot = Object.freeze({
      phase: current.snapshot.phase,
      gameType: current.snapshot.gameType,
      isSeated: current.snapshot.isSeated,
      canSwitchAccount: current.snapshot.canSwitchAccount,
      canSyncProfile: current.snapshot.canSyncProfile,
      updateProfile: current.capability.updateProfile,
      leaveSeat: current.capability.leaveSeat,
    });
    return lastSnapshot;
  };

  return {
    getSnapshot,
    subscribe: (listener) => {
      const unsubscribers = new Map<RoomAccountCapability, () => void>();
      const subscribeLoaded = (): void => {
        for (const capability of accounts.current()) {
          if (!unsubscribers.has(capability)) {
            unsubscribers.set(capability, capability.subscribe(listener));
          }
        }
      };
      subscribeLoaded();
      const unsubscribeLoads = accounts.subscribe(() => {
        subscribeLoaded();
        listener();
      });
      return () => {
        unsubscribeLoads();
        for (const unsubscribe of unsubscribers.values()) unsubscribe();
      };
    },
  };
}
