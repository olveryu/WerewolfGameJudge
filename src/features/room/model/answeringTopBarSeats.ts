/**
 * Seats for the shared answering top bar: one entry per occupied seat,
 * with the submitted state read off the seat status badge.
 *
 * Both games project submission onto the same badge tone — Story Relay
 * marks a ready seat `success`, Pictionary a submitted task `success` —
 * so the bar never reads game state directly.
 */

import type { RoomSeatDataSource } from './RoomSeatDataSource';

/** Seat avatar colours, cycled by seat order (v3 design). */
export const ANSWERING_TOP_BAR_SEAT_COLORS = [
  '#7C6FF0',
  '#F59E0B',
  '#94A3B8',
  '#0EA5A4',
  '#EC4899',
  '#6366F1',
] as const;

/** The overflow "+N" circle reuses the slate grey from the palette. */
export const ANSWERING_TOP_BAR_OVERFLOW_COLOR = ANSWERING_TOP_BAR_SEAT_COLORS[2];

export interface AnsweringTopBarSeat {
  /** Zero-based seat number; the React key — display names are not unique. */
  readonly seat: number;
  readonly displayName: string;
  /** Avatar initial: first two letters for ASCII names, first character otherwise. */
  readonly initial: string;
  readonly color: string;
  readonly submitted: boolean;
}

/** "JY" reads as "JY", "Jo" as "JO", "文森特" as "文". */
function seatInitial(displayName: string): string {
  const first = displayName.charAt(0);
  if (!/[A-Za-z]/.test(first)) return first;
  const asciiPair = displayName.slice(0, 2);
  return /^[A-Za-z]{2}$/.test(asciiPair) ? asciiPair.toUpperCase() : first.toUpperCase();
}

export function getAnsweringTopBarSeats(source: RoomSeatDataSource): AnsweringTopBarSeat[] {
  const seats: AnsweringTopBarSeat[] = [];
  for (let seat = 0; seat < source.count; seat += 1) {
    const seatView = source.getSeat(seat);
    const player = seatView.player;
    if (player === null) continue;
    // The modulo always lands inside the palette; the fallback only
    // satisfies noUncheckedIndexedAccess.
    const color =
      ANSWERING_TOP_BAR_SEAT_COLORS[seat % ANSWERING_TOP_BAR_SEAT_COLORS.length] ??
      ANSWERING_TOP_BAR_SEAT_COLORS[0];
    seats.push({
      seat,
      displayName: player.displayName,
      initial: seatInitial(player.displayName),
      color,
      submitted: seatView.statusBadge?.tone === 'success',
    });
  }
  return seats;
}
