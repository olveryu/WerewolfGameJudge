/**
 * Canonical room viewers for client tests: one fixture per audience so
 * every per-viewer contract test (guidance matrices, shell models)
 * reads the same host / seated / spectator identities instead of
 * re-deriving `isHost` + seat per game.
 */

import type { RoomViewer, RoomViewerAudience } from '@/features/room/model/RoomViewer';

export interface RoomViewerFixtureOptions {
  readonly hostUserId?: string;
  readonly hostSeat?: number;
  readonly seatedUserId?: string;
  readonly seatedSeat?: number;
  readonly spectatorUserId?: string;
}

const DEFAULTS: Required<RoomViewerFixtureOptions> = {
  hostUserId: 'host',
  hostSeat: 0,
  seatedUserId: 'u1',
  seatedSeat: 1,
  spectatorUserId: 'spectator',
};

/** The viewer of the given audience: the host sits at `hostSeat`, the seated player at `seatedSeat`. */
export function viewerFor(
  audience: RoomViewerAudience,
  options: RoomViewerFixtureOptions = {},
): RoomViewer {
  const config = { ...DEFAULTS, ...options };
  switch (audience) {
    case 'host':
      return { userId: config.hostUserId, isHost: true, seat: config.hostSeat };
    case 'seated':
      return { userId: config.seatedUserId, isHost: false, seat: config.seatedSeat };
    case 'spectator':
      return { userId: config.spectatorUserId, isHost: false, seat: null };
  }
}
