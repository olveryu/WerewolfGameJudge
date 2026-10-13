/**
 * Status ribbon factories — the single construction site for the two
 * shared ribbon shapes and for cross-game ribbon copy. Games still
 * decide WHAT their phase says; they no longer hand-assemble the
 * model object or re-type shared strings like the lobby waiting
 * line, so wording and shape cannot drift per game.
 */

import type { NightStepProgress } from './nightProgress';
import type { RoomStatusRibbonModel } from './RoomShellModel';

/** A plain message ribbon (guide icon unless the caller says otherwise). */
export function messageRibbon(
  text: string,
  supportingText: string | null = null,
  icon: 'guide' | 'speaking' = 'guide',
): RoomStatusRibbonModel {
  return { kind: 'message', icon, text, supportingText };
}

/** A step-progress ribbon from a resolved night/step progress. */
export function progressRibbon(progress: NightStepProgress): RoomStatusRibbonModel {
  return {
    kind: 'progress',
    current: progress.current,
    total: progress.total,
    label: progress.label,
  };
}

/** The lobby waiting line shared by every seated game: 「等待入座 · x/y」. */
export function buildLobbyWaitingText(occupiedCount: number, totalCount: number): string {
  return `等待入座 · ${occupiedCount}/${totalCount}`;
}
