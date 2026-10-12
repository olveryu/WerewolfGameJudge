/**
 * Pictionary viewer projections: what one seat may see of the
 * relay. The task projection is the privacy boundary of the game:
 * a seat sees its own chain's immediately previous entry only,
 * never the chain's earlier entries or any other chain.
 */

import {
  getPictionaryExpectedKind,
  type PictionaryState,
  type PictionaryTask,
} from '../state/types';

export function getPictionaryTaskForSeat(
  state: PictionaryState,
  seat: number,
): PictionaryTask | null {
  if (state.roundId === null || state.stepIndex < 0) return null;
  const seatIndex = state.seatOrder.indexOf(seat);
  if (seatIndex < 0) return null;
  const seatOffset = state.stepOffsets[state.stepIndex];
  if (seatOffset === undefined) throw new Error('Pictionary relay step offset is missing');
  const chainIndex =
    (seatIndex - seatOffset + state.config.numberOfPlayers) % state.config.numberOfPlayers;
  const chain = state.chains[chainIndex];
  if (chain === undefined) return null;
  return {
    chainIndex,
    chain,
    expectedKind: getPictionaryExpectedKind(state.stepIndex),
    previousEntry: state.stepIndex === 0 ? null : (chain.entries[state.stepIndex - 1] ?? null),
  };
}
