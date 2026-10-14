/**
 * Applies Story Relay domain events; reset paths clear all round-owned state.
 *
 * Round-slice landing shapes come from the shared relay machine
 * (platform/room/relay/evolve); this module lands Story Relay's own
 * fields (startedAt / completedAt / abortedAt, roster, config) and
 * clears them wherever the shared reset clears the round.
 */

import {
  applyRelayEntryAppended,
  applyRelayPhaseChanged,
  applyRelayRoundStarted,
  applyRelayTaskReady,
  clearRelayRound,
} from '../../../platform/room/relay/evolve';
import { applyRosterChanges } from '../../../platform/room/seating';
import type { StoryRelayEntry, StoryRelayState } from '../state/types';
import type { StoryRelayEvent } from './decision';

/** Evolves a committed domain event without persistence or broadcasts. */
export function evolveStoryRelayState(
  state: StoryRelayState,
  event: StoryRelayEvent,
): StoryRelayState {
  switch (event.type) {
    case 'storyrelay.seats.changed':
      return { ...state, roster: applyRosterChanges(state.roster, event.changes) };
    case 'storyrelay.config.updated':
      return { ...state, config: event.config };
    case 'storyrelay.round.started':
      return {
        ...state,
        ...applyRelayRoundStarted(state, event.round),
        completedAt: null,
        abortedAt: null,
      };
    case 'storyrelay.task.ready':
      return { ...state, ...applyRelayTaskReady(state.readySeats, event.seat, event.isReady) };
    case 'storyrelay.entries.appended':
      return { ...state, ...applyRelayEntryAppended(state.chains, event.chainId, event.entry) };
    case 'storyrelay.phase.changed':
      return { ...state, ...applyRelayPhaseChanged(state, event) };
    case 'storyrelay.round.completed':
      return { ...state, completedAt: event.completedAt };
    case 'storyrelay.round.aborted':
      return {
        ...state,
        phase: 'aborted',
        phaseRevision: state.phaseRevision + 1,
        abortedAt: event.abortedAt,
        deadlineAt: null,
        readySeats: [],
      };
    case 'storyrelay.game.returnedToLobby':
      return {
        ...state,
        ...clearRelayRound<StoryRelayEntry>(state),
        startedAt: null,
        completedAt: null,
        abortedAt: null,
      };
  }
}
