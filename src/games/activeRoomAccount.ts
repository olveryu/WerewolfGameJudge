/** Resolve one active room account capability across the exhaustive game catalog. */

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

export interface ActiveRoomAccountSource {
  readonly getSnapshot: () => ActiveRoomAccountSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
}

export function createActiveRoomAccountSource(
  capabilities: readonly RoomAccountCapability[],
): ActiveRoomAccountSource {
  let lastCapability: RoomAccountCapability | null = null;
  let lastGameSnapshot: GameRoomAccountSnapshot | null = null;
  let lastSnapshot = IDLE_SNAPSHOT;

  const getSnapshot = (): ActiveRoomAccountSnapshot => {
    const active = capabilities
      .map((capability) => ({
        capability,
        snapshot: capability.getSnapshot(),
      }))
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
      const unsubscribers = capabilities.map((capability) => capability.subscribe(listener));
      return () => {
        for (const unsubscribe of unsubscribers) unsubscribe();
      };
    },
  };
}
