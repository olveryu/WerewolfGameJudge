/** Shared profile-card model with explicit game-owned presentation extensions. */

import type { RoomProfileTarget } from './RoomCapabilities';

export interface RoomProfileCardModel {
  readonly target: RoomProfileTarget;
  readonly isSelf: boolean;
  readonly onClose: () => void;
  readonly onKick: (() => void) | null;
  readonly onLeaveSeat: (() => void) | null;
  /**
   * Game-specific public stats section, as data: the card renders the
   * section title and asks the game's Screen (via RoomShell's
   * profileDetailsRenderer) to render the stats for statsUserId.
   */
  readonly gameDetails: {
    readonly title: string;
    readonly statsUserId: string;
  } | null;
}
