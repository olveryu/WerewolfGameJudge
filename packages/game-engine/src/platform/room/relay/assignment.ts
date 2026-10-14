/**
 * Relay assignment: the seeded seat rotation for one round.
 *
 * The seat order is a seeded shuffle; the step offsets follow the
 * Williams construction so that across the N steps every seat visits
 * every chain exactly once and no seat follows itself. Both relay
 * games share this construction; only the seed suffix, the supported
 * player range and its error copy are game-owned.
 */

import { createSeededRng, shuffleArray } from '../../random';
import { getBotDisplayName } from '../getBotDisplayName';
import { isBotOccupant, type RosterMap, type SeatOccupant } from '../seating';
import type { RelayChain, RelayParticipant } from './types';

/** Game-owned knobs for one game's assignment: seed identity and player range. */
export interface RelayAssignmentOptions {
  readonly seedSuffix: string;
  readonly minPlayers: number;
  readonly maxPlayers: number;
  readonly rangeError: string;
}

/** Creates the persisted player permutation and Williams relay offsets for one round. */
export function createRelayAssignment(
  numberOfPlayers: number,
  randomSeed: string,
  options: RelayAssignmentOptions,
) {
  if (
    !Number.isSafeInteger(numberOfPlayers) ||
    numberOfPlayers < options.minPlayers ||
    numberOfPlayers > options.maxPlayers
  ) {
    throw new Error(options.rangeError);
  }
  const seatOrder = shuffleArray(
    Array.from({ length: numberOfPlayers }, (_, seat) => seat),
    createSeededRng(`${randomSeed}${options.seedSuffix}`),
  );
  const stepOffsets = Array.from({ length: numberOfPlayers }, (_, stepIndex) =>
    stepIndex % 2 === 1 ? (stepIndex + 1) / 2 : (numberOfPlayers - stepIndex / 2) % numberOfPlayers,
  );
  return { seatOrder, stepOffsets };
}

/** Builds one empty chain per seat in the round's seat order. */
export function buildRelayChains<TEntry>(
  roundId: string,
  seatOrder: readonly number[],
): readonly RelayChain<TEntry>[] {
  return seatOrder.map((originSeat) => ({
    id: `${roundId}:chain:${originSeat}`,
    originSeat,
    entries: [],
  }));
}

/**
 * Freezes the round's participant list from the live roster: humans
 * keep their user id and display name, bot seats use the platform
 * bot display name and carry no user id.
 */
export function buildRelayParticipants<TSeat extends SeatOccupant>(
  seatOrder: readonly number[],
  roster: RosterMap<TSeat>,
  getHumanDisplayName: (occupant: TSeat) => string,
): readonly RelayParticipant[] {
  return seatOrder.map((seat) => {
    const occupant = roster[seat];
    const human = occupant != null && !isBotOccupant(occupant) ? occupant : null;
    return {
      seat,
      userId: human === null ? null : human.userId,
      displayName: human === null ? getBotDisplayName(seat) : getHumanDisplayName(human),
    };
  });
}
