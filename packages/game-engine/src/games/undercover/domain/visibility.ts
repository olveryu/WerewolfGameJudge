/** Undercover display projections for authenticated humans and authorized robot control. */

import { findSeatByUserId } from '../../../platform/room/seating';
import type { UndercoverState } from '../state/types';

export type UndercoverWordCard =
  | { readonly kind: 'word'; readonly seat: number; readonly word: string }
  | { readonly kind: 'blank'; readonly seat: number };

/** Returns only the viewer's word card; no affiliation for players who received words. */
export function getUndercoverWordCard(
  state: UndercoverState,
  userId: string,
  controlledSeat: number | null,
): UndercoverWordCard | null {
  if (state.phase !== 'reading' && state.phase !== 'ongoing') return null;
  let seat: number | null;
  if (controlledSeat !== null) {
    if (
      userId !== state.hostUserId ||
      !state.config.isTestMode ||
      !state.botSeats.includes(controlledSeat)
    )
      return null;
    seat = controlledSeat;
  } else seat = findSeatByUserId(state.realSeats, state.config.numberOfPlayers, userId);
  if (seat === null) return null;
  const role = state.round.roles[seat];
  switch (role) {
    case 'civilian':
      return { kind: 'word', seat, word: state.round.civilianWord };
    case 'undercover':
      return { kind: 'word', seat, word: state.round.undercoverWord };
    case 'blank':
      return { kind: 'blank', seat };
    default:
      throw new Error('Invalid Undercover viewer seat');
  }
}
