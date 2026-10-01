/** Product-home contracts contributed by concrete client game modules. */

import type Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';

export type GameModeIconName = React.ComponentProps<typeof Ionicons>['name'];

/**
 * Home placement tier of a game mode.
 * - 'main': the flagship game (Werewolf) — hero placement in the create picker.
 * - 'mini': lightweight party games — grouped under the 小游戏 section.
 */
export type GameHomeTier = 'main' | 'mini';

export interface GameModePresentation {
  readonly displayName: string;
  readonly subtitle: string;
  readonly iconName: GameModeIconName;
  readonly tier: GameHomeTier;
}

export interface GameAnnouncementTabContentProps {
  readonly maxHeight: number;
}

export interface GameAnnouncementTabContribution {
  /** Stable within one game module. */
  readonly id: string;
  readonly label: string;
  readonly Content: React.ComponentType<GameAnnouncementTabContentProps>;
}

export interface GameHomeContribution {
  readonly mode: GameModePresentation;
  readonly spotlight: React.ComponentType | null;
  readonly announcementTabs: readonly GameAnnouncementTabContribution[];
}
