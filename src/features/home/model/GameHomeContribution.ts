/** Product-home contracts contributed by concrete client game modules. */

import type Ionicons from '@expo/vector-icons/Ionicons';
import type React from 'react';
import type { ImageSourcePropType } from 'react-native';

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
  /** Theme gradient stops (light → dark) owned by the game; backs picker cards and icon chips. */
  readonly gradient: readonly [string, string];
  /**
   * Optional key art for picker cards and hero dots. Games that ship art
   * render it as the card surface; the rest fall back to `gradient`.
   */
  readonly art?: ImageSourcePropType;
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
