/**
 * Legacy roster materialization shared by the pre-unification state
 * migrations. Before the unified roster, persisted states stored only
 * the human seats plus the implicit-bot derivation inputs (a fill flag
 * and an exclusion list); the roster a migration must produce is the
 * humans plus a bot occupant on exactly the seats the retired
 * derivation would have named: fill enabled, no human seated, and the
 * seat not excluded.
 */

import type { BotSeatOccupant } from '../room/seating';

export function materializeLegacyRoster<THuman extends { readonly seat: number }>(input: {
  readonly humans: Readonly<Record<number, THuman>>;
  readonly fillEmptySeatsWithBots: boolean;
  readonly excludedBotSeats: readonly number[];
  readonly numberOfPlayers: number;
}): Record<number, THuman | BotSeatOccupant> {
  const roster: Record<number, THuman | BotSeatOccupant> = { ...input.humans };
  if (input.fillEmptySeatsWithBots) {
    for (let seat = 0; seat < input.numberOfPlayers; seat += 1) {
      if (roster[seat] === undefined && !input.excludedBotSeats.includes(seat)) {
        roster[seat] = { seat, kind: 'bot' };
      }
    }
  }
  return roster;
}
