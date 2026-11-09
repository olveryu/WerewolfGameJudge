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

export interface GameHomeContribution {
  readonly mode: GameModePresentation;
}
