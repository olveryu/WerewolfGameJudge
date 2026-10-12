/** FibKing decision plumbing: the commit shape over FibEvent/FibEffect. */

import { commit, type Decision } from '../../../platform/engine';
import type { FibEffect } from '../effects/types';
import type { FibEvent } from './events';

export type FibDecision = Decision<FibEvent, FibEffect>;

export function commitFib(
  events: readonly FibEvent[],
  effects: readonly FibEffect[] = [],
): FibDecision {
  return commit({
    events,
    effects,
    broadcast: events.length === 0 ? 'none' : 'state',
  });
}
