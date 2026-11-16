/** Home-surface contracts each client game module contributes. */
import type { ComponentType, SVGProps } from 'react';

/**
 * Home placement tier of a game mode.
 * - 'main': games grouped under 主游戏 in the picker.
 * - 'mini': lightweight party games, grouped under 小游戏.
 */
export type GameHomeTier = 'main' | 'mini';

/**
 * A family of games sharing one core mechanic (for example the two drawing games).
 * Family members render as one group card in the picker, headed by the family name.
 */
export interface GameModeFamily {
  /** Stable within the catalog; members share one group card. */
  readonly id: string;
  readonly displayName: string;
}

export interface GameModePresentation {
  readonly displayName: string;
  readonly subtitle: string;
  /** Ionicons glyph from `~icons/ion/*`. */
  readonly Icon: ComponentType<SVGProps<SVGSVGElement>>;
  readonly tier: GameHomeTier;
  /** Family this game belongs to, when it shares a mechanic with sibling games. */
  readonly family?: GameModeFamily;
  /** Theme gradient stops (light → dark) owned by the game for its shared presentation. */
  readonly gradient: readonly [string, string];
  /** Key art URL; games without art use the second gradient color behind their picker icon. */
  readonly artUrl?: string;
}

export interface GameAnnouncementTabContribution {
  /** Stable within one game module. */
  readonly id: string;
  readonly label: string;
  /** Tab body code is available at start-up; mounting remains controlled by the modal. */
  readonly Content: ComponentType;
}

export interface GameHomeContribution {
  readonly mode: GameModePresentation;
  /** The game's Home spotlight card, available at start-up. */
  readonly Spotlight?: ComponentType;
  /** Game-owned tabs of the Home announcement modal, after the shared changelog tab. */
  readonly announcementTabs?: readonly GameAnnouncementTabContribution[];
}
