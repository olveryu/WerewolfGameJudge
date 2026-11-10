/** Home-surface contracts each client game module contributes. */
import type { ComponentType, SVGProps } from 'react';

/**
 * Home placement tier of a game mode.
 * - 'main': flagship games (hero placement in the create picker).
 * - 'mini': lightweight party games, grouped under 小游戏.
 */
export type GameHomeTier = 'main' | 'mini';

export interface GameModePresentation {
  readonly displayName: string;
  readonly subtitle: string;
  /** Ionicons glyph from `~icons/ion/*`. */
  readonly Icon: ComponentType<SVGProps<SVGSVGElement>>;
  readonly tier: GameHomeTier;
  /** Theme gradient stops (light → dark) owned by the game; backs picker cards and icon chips. */
  readonly gradient: readonly [string, string];
  /** Key art URL; games without art render `gradient` instead. */
  readonly artUrl?: string;
}

export interface GameAnnouncementTabContribution {
  /** Stable within one game module. */
  readonly id: string;
  readonly label: string;
  /** Loads the tab body; it ships in its own chunk, fetched when the announcement modal opens. */
  readonly loadContent: () => Promise<ComponentType>;
}

export interface GameHomeContribution {
  readonly mode: GameModePresentation;
  /** Loads the game's Home spotlight card; it ships in its own chunk, outside the Home budget. */
  readonly loadSpotlight?: () => Promise<ComponentType>;
  /** Game-owned tabs of the Home announcement modal, after the shared changelog tab. */
  readonly announcementTabs?: readonly GameAnnouncementTabContribution[];
}
