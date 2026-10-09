/**
 * Identity Viewing Protocol — shared pure rules (P-1).
 *
 * Games that deal secret identities (werewolf, avalon, fibking,
 * undercover) record per-seat "has viewed" state on the server and gate
 * a checkpoint on every human having viewed. The record lives in each
 * game's own state machine; these helpers are the single implementation
 * of the protocol's pure decisions so the four engines cannot drift:
 *
 * - markSeatViewed: idempotent insert into the viewed-seat set.
 * - listUnviewedSeats: who has not viewed yet (host-facing).
 * - haveAllHumansViewed: the checkpoint predicate; bots never block
 *   (each game decides how bot seats get marked — host action in
 *   werewolf, engine auto-mark in fibking).
 */

export interface IdentityViewingParticipant {
  readonly seat: number;
  readonly isBot: boolean;
}

/** Idempotently add a seat to the viewed set; returns the input when already present. */
export function markSeatViewed(viewedSeats: readonly number[], seat: number): readonly number[] {
  if (viewedSeats.includes(seat)) return viewedSeats;
  return [...viewedSeats, seat].sort((a, b) => a - b);
}

/** Participants that have not viewed yet, in participant order. */
export function listUnviewedSeats(
  participants: readonly IdentityViewingParticipant[],
  viewedSeats: readonly number[],
): readonly IdentityViewingParticipant[] {
  return participants.filter((participant) => !viewedSeats.includes(participant.seat));
}

/** Checkpoint predicate: every non-bot participant has viewed. */
export function haveAllHumansViewed(
  participants: readonly IdentityViewingParticipant[],
  viewedSeats: readonly number[],
): boolean {
  return participants.every(
    (participant) => participant.isBot || viewedSeats.includes(participant.seat),
  );
}
