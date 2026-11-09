/**
 * The rounds of one game that the cross-game review contract
 * (`src/__tests__/roomReview.contract.test.ts`) resolves. Each game
 * declares them next to its other state fixtures, from rounds played
 * through its real engine.
 */
export interface ReviewTestRounds<TState> {
  /** A room with nothing to review yet. */
  readonly lobby: () => TState;
  /** A finished round, which the host reads and shares. */
  readonly ended: () => TState;
  /** The finished round as the room's next round: only the round identity its review key follows advances. */
  readonly nextRound: (ended: TState) => TState;
}
