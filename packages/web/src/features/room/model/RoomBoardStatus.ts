import type { ReactElement } from 'react';

/**
 * A game's status for the one status bar above the seat board, as data. Only the shell renders
 * the bar, so a game can never add a second one; audio narration and seat selection replace its
 * message line and hide its progress while keeping the context and attachment.
 */
export interface RoomBoardStatusModel {
  /** Null falls back to the shell's phase label. */
  readonly context: string | null;
  readonly message: string | null;
  /** Submission progress, e.g. "已投 2/8"; carries the status test id when there is no message. */
  readonly progress: string | null;
  readonly pendingSeats: {
    readonly seats: readonly number[];
    readonly label: string;
    readonly testId?: string;
  } | null;
  /** Null falls back to the shell's status icon. */
  readonly icon: ReactElement | null;
  /** Public game content inside the same bar below its lines, such as score tracks. */
  readonly attachment: ReactElement | null;
  readonly testId?: string;
  readonly contextTestId?: string;
}
