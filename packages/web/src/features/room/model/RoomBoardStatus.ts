import type { IoniconName } from '@/components/icons/IonIcon';

/** How a track cell reads: settled, the one in play, or still ahead. */
export type RoomTrackCellState = 'success' | 'fail' | 'current' | 'upcoming';

/** One cell of a public track, e.g. a mission or an enacted policy. */
export interface RoomTrackCell {
  readonly key: string;
  readonly state: RoomTrackCellState;
  /** Bold first line, e.g. "任务1"; null when the cell is a single plain line. */
  readonly title: string | null;
  readonly lines: readonly string[];
  /** A read-only rule explanation the shell opens when the cell is pressed. */
  readonly detail?: {
    readonly accessibleLabel: string;
    readonly title: string;
    readonly body: string;
  };
}

/** A public track: a heading over a row of cells. */
export interface RoomTrack {
  readonly key: string;
  readonly heading: string;
  readonly accessibleLabel: string;
  readonly cells: readonly RoomTrackCell[];
}

/**
 * A game's status for the one status bar above the seat board, as data only: no React content,
 * so a game can never draw a second bar or its own lines inside this one. Audio narration and
 * seat selection replace its message line and hide its progress, keeping everything else.
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
  readonly icon: IoniconName | null;
  /** Public tracks at the bottom of the bar, such as missions or policies. */
  readonly tracks: readonly RoomTrack[];
  /** A secondary line under the tracks, such as the latest public result. */
  readonly footnote: string | null;
  readonly testId?: string;
  readonly contextTestId?: string;
}

/**
 * A public text line the shell keeps inside the one status bar in every phase, with or without a
 * game `boardStatus` (e.g. a dawn announcement). Text only: the shell renders the line.
 */
export interface RoomStatusNotice {
  readonly key: string;
  readonly text: string;
}
