/** Undercover display projections for authenticated humans and authorized robot control. */

import { resolveActingSeatForUser } from '../../../platform/room/actingSeat';
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
  if (state.phase !== 'viewing' && state.phase !== 'ongoing') return null;
  // Seat resolution is the platform acting-seat gates (PR-2); every
  // rejection (not host, controlled seat not a bot, not seated)
  // collapses to no card, exactly as the inline gates did.
  const acting = resolveActingSeatForUser(
    state,
    state.config.numberOfPlayers,
    userId,
    controlledSeat,
  );
  if (acting.kind === 'rejected') return null;
  const seat = acting.value;
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
