/**
 * Stage content model (docs/room-stage-layout-design.md): the one-line information bar a game
 * gives the shell for its in-play phases, and the roster grouping shared by the bar's roster chip
 * and its sheet. Pure data; the shell renders it.
 */

import { isRoomBottomActionModelEmpty } from './RoomBottomActions';
import type { RoomSeatDataSource, RoomSeatStatusBadge } from './RoomSeatDataSource';
import type { RoomShellModel } from './RoomShellModel';

/** Seconds at or below which the stage countdown turns red. */
export const ROOM_STAGE_URGENT_SECONDS = 10;

/** A game information chip (step, round, word hint, score), rendered in order. */
export interface RoomStageChip {
  readonly key: string;
  readonly label: string;
  /** Secondary text after the label (the word length beside a hint); null when there is none. */
  readonly detail: string | null;
  readonly tone: 'neutral' | 'accent';
}

/** The stage countdown; the shell renders a chip and, when the total is known, a thin bar. */
export interface RoomStageTimerModel {
  /** What the countdown runs for (「作答」「作画」「结算」), read by assistive technology. */
  readonly label: string;
  /** Null means the phase has no time limit: the chip reads 「不限时」 and no bar renders. */
  readonly remainingSeconds: number | null;
  /** Full phase length for the bar; null renders the chip without a bar. */
  readonly totalSeconds: number | null;
}

/** The roster chip and the sheet it opens (with the host's bot takeover). */
export interface RoomStageRosterModel {
  /** The chip text, a game-computed summary such as 「已完成 2/5」. */
  readonly chipLabel: string;
  /** The sheet heading. */
  readonly title: string;
  readonly groupTitles: {
    readonly acting: string;
    readonly pending: string;
    readonly done: string;
  };
  /** The seat the room is waiting on (DrawGuess's drawer); null when every seat acts at once. */
  readonly actingSeat: number | null;
  /** Status text for a seat that carries no status badge. */
  readonly pendingLabel: string;
  /** A bot must act soon and nobody has taken it over; the chip shows an alert mark. */
  readonly isUrgent: boolean;
}

export interface RoomStageHudModel {
  readonly chips: readonly RoomStageChip[];
  readonly roster: RoomStageRosterModel | null;
  readonly timer: RoomStageTimerModel | null;
}

export type RoomStageRosterGroup = 'acting' | 'pending' | 'done';

export interface RoomStageRosterEntry {
  readonly seat: number;
  readonly displayName: string;
  readonly isBot: boolean;
  readonly isSelf: boolean;
  readonly group: RoomStageRosterGroup;
  readonly statusLabel: string;
  readonly statusTone: RoomStageRosterStatusTone;
}

export type RoomStageRosterStatusTone = RoomSeatStatusBadge['tone'];

export interface RoomStageRosterGroups {
  readonly acting: readonly RoomStageRosterEntry[];
  readonly pending: readonly RoomStageRosterEntry[];
  readonly done: readonly RoomStageRosterEntry[];
}

/**
 * Groups the occupied seats for the roster: the acting seat first, a seat whose status badge has
 * the success tone is done, every other seat is pending. The status text is the seat's badge
 * label, or `pendingLabel` for a seat without a badge. Seat order is kept inside each group.
 */
export function groupRoomStageRoster(
  source: RoomSeatDataSource,
  input: { readonly actingSeat: number | null; readonly pendingLabel: string },
): RoomStageRosterGroups {
  const acting: RoomStageRosterEntry[] = [];
  const pending: RoomStageRosterEntry[] = [];
  const done: RoomStageRosterEntry[] = [];
  for (let index = 0; index < source.count; index += 1) {
    const seat = source.getSeat(index);
    if (seat.player === null) continue;
    const badge = seat.statusBadge;
    const group: RoomStageRosterGroup =
      seat.seat === input.actingSeat ? 'acting' : badge?.tone === 'success' ? 'done' : 'pending';
    const entry: RoomStageRosterEntry = {
      seat: seat.seat,
      displayName: seat.player.displayName,
      isBot: seat.player.occupant.kind === 'bot',
      isSelf: seat.isSelf,
      group,
      statusLabel: badge?.label ?? input.pendingLabel,
      statusTone: badge?.tone ?? 'muted',
    };
    (group === 'acting' ? acting : group === 'done' ? done : pending).push(entry);
  }
  if (input.actingSeat !== null && acting.length === 0) {
    throw new Error(`Stage roster acting seat ${input.actingSeat} is not occupied`);
  }
  return { acting, pending, done };
}

/** Occupied seats and how many of them are done, for the games' roster chip text. */
export function countRoomStageRoster(groups: RoomStageRosterGroups): {
  readonly done: number;
  readonly total: number;
} {
  return {
    done: groups.done.length,
    total: groups.acting.length + groups.pending.length + groups.done.length,
  };
}

/**
 * Stage content renders no bottom panel and no host task card: everything the step says lives in
 * the information bar and the game's own dock, and host management opens from the header. A shell
 * model that still carries bottom content, narration or a host task is an adapter bug.
 */
export function assertRoomStageShellModel(
  model: Pick<RoomShellModel, 'bottomActions' | 'isAudioPlaying' | 'hostManagement'>,
): void {
  if (!isRoomBottomActionModelEmpty(model.bottomActions)) {
    throw new Error('Stage content cannot carry bottom actions, messages or progress');
  }
  if (model.isAudioPlaying) {
    throw new Error('Stage content cannot play narration audio');
  }
  if (model.hostManagement !== null && model.hostManagement.task !== null) {
    throw new Error('Stage content cannot carry a host task card');
  }
}
