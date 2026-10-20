/** Pictionary decision plumbing: the commit shape over PictionaryEvent/PictionaryEffect. */

import { commit, type Decision } from '../../../platform/engine';
import type { PictionaryEffect } from '../effects/types';
import type { PictionaryEvent } from './events';

export type PictionaryDecision = Decision<PictionaryEvent, PictionaryEffect>;

export function commitPictionary(
  events: readonly PictionaryEvent[],
  effects: readonly PictionaryEffect[] = [],
): PictionaryDecision {
  return commit({ events, effects });
}
