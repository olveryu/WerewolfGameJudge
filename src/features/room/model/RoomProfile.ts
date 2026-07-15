/** Shared profile-card model with explicit game-owned presentation extensions. */

import type React from 'react';

import type { RoomProfileTarget } from './RoomCapabilities';

export interface RoomProfileCardModel {
  readonly target: RoomProfileTarget;
  readonly isSelf: boolean;
  readonly onClose: () => void;
  readonly onKick: (() => void) | null;
  readonly onLeaveSeat: (() => void) | null;
  readonly gameDetails: {
    readonly title: string;
    readonly content: React.ReactElement;
  } | null;
}
