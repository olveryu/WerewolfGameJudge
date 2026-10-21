/**
 * Pictionary viewer projections: what one seat may see of the
 * relay. The task projection is the privacy boundary of the game:
 * a seat sees its own chain's immediately previous entry only,
 * never the chain's earlier entries or any other chain.
 *
 * The projection itself is the shared relay machine's
 * (platform/room/relay); this module only maps the machine's task
 * onto Pictionary's public shape — the whole chain plus the step's
 * expected entry kind — which the client consumes. The previous
 * entry crosses the boundary whole: the strip is the identity,
 * exactly as Pictionary's relay kit declares for its own tasks.
 */

import { getRelayTaskForSeat } from '../../../platform/room/relay/tasks';
import {
  getPictionaryExpectedKind,
  type PictionaryEntry,
  type PictionaryState,
  type PictionaryTask,
} from '../state/types';
import { toPictionaryRelaySlice } from './relay';

export function getPictionaryTaskForSeat(
  state: PictionaryState,
  seat: number,
): PictionaryTask | null {
  const task = getRelayTaskForSeat<PictionaryEntry, PictionaryEntry>(
    toPictionaryRelaySlice(state),
    seat,
    state.config.numberOfPlayers,
    (entry) => entry,
  );
  if (task === null) return null;
  const chainIndex = state.chains.findIndex((chain) => chain.id === task.chainId);
  const chain = state.chains[chainIndex];
  if (chain === undefined) throw new Error('Relay task chain missing');
  return {
    chainIndex,
    chain,
    expectedKind: getPictionaryExpectedKind(state.stepIndex),
    previousEntry: task.previousEntry,
  };
}
