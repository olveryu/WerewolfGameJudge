/**
 * Identity Viewing Protocol — shared pure rules (P-1).
 *
 * Games that deal secret identities (werewolf, avalon, fibking,
 * undercover) record per-seat "has viewed" state on the server and gate
 * the start of play on the record being complete: every seated
 * player, bots included, must be marked viewed before the game can
 * begin (the werewolf rule, adopted platform-wide 2026-10-12). Humans
 * mark themselves by viewing; bot seats are marked by the host through
 * the manual-test scaffold action (mark all bots viewed) — engines
 * never auto-mark. The record lives in each game's own state machine;
 * these helpers are the single implementation of the protocol's pure
 * decisions so the four engines cannot drift:
 *
 * - markSeatViewed: idempotent insert into the viewed-seat set.
 * - listUnviewedSeats: who has not viewed yet (host-facing).
 * - listUnviewedBotSeats: the seats the host scaffold action fills.
 * - haveAllViewed: the checkpoint predicate; every participant counts.
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

/** Checkpoint predicate (the start gate): every participant has viewed. */
export function haveAllViewed(
  participants: readonly IdentityViewingParticipant[],
  viewedSeats: readonly number[],
): boolean {
  return participants.every((participant) => viewedSeats.includes(participant.seat));
}

/** Bot seats the host scaffold action still has to mark, in participant order. */
export function listUnviewedBotSeats(
  participants: readonly IdentityViewingParticipant[],
  viewedSeats: readonly number[],
): readonly IdentityViewingParticipant[] {
  return participants.filter(
    (participant) => participant.isBot && !viewedSeats.includes(participant.seat),
  );
}
