/**
 * Settlement completion payloads (AU-42).
 *
 * Every game's terminal decision emits one completion effect whose
 * payload is `{ roundId, completedAt, participantUserIds }`; the
 * worker settles XP and rewards from it. This builder is the one
 * assembly point: the caller supplies its human seats in seat order
 * (from the live roster, or from a round's frozen participant list
 * where the game keeps one), and the builder applies the game's
 * optional authorship filter (pictionary and storyrelay reward
 * actual authors only — a registered product difference, injected
 * as includeSeat) and assembles the payload.
 *
 * Exactly-once: each game emits the effect from behind a one-way
 * phase transition into its terminal phase, so the emitting branch
 * is unreachable twice. Avalon is the registered exception: its
 * terminal event can be produced by several converging end paths
 * (quests, veto limit, assassination), so it carries an explicit
 * xpSettled state flag and checks it at every emission site.
 */

export interface GameCompletionPayload {
  readonly roundId: string;
  readonly completedAt: number;
  readonly participantUserIds: readonly string[];
}

export function buildGameCompletionPayload<
  TSeat extends { readonly seat: number; readonly userId: string },
>(input: {
  readonly roundId: string;
  readonly completedAt: number;
  /** The game's human seats, in seat order. */
  readonly humans: readonly TSeat[];
  /** Narrows the rewarded humans (authorship filters); defaults to every supplied human. */
  readonly includeSeat?: (seat: TSeat) => boolean;
}): GameCompletionPayload {
  const participantUserIds = input.humans
    .filter((seat) => input.includeSeat === undefined || input.includeSeat(seat))
    .map((seat) => seat.userId);
  return { roundId: input.roundId, completedAt: input.completedAt, participantUserIds };
}
