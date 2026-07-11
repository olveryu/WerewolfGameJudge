/** Shared profile-card model with explicit game-owned presentation extensions. */

import type React from 'react';

import type { UserPublicProfile } from '@/services/feature/StatsService';

import type { RoomProfileTarget } from './RoomCapabilities';

export interface RoomProfileCardModel {
  readonly target: RoomProfileTarget;
  readonly isSelf: boolean;
  readonly onClose: () => void;
  readonly onKick: (() => void) | null;
  readonly onLeaveSeat: (() => void) | null;
  readonly resolveBuiltinAvatarName: (avatarId: string) => string;
  readonly gameDetails: {
    readonly title: string;
    readonly render: (profile: UserPublicProfile) => React.ReactNode;
  } | null;
}
