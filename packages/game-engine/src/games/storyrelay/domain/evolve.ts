/** Applies Story Relay domain events; reset paths clear all round-owned state. */

import type { StoryRelayState } from '../state/types';
import type { StoryRelayEvent } from './decision';

/** Resets mutable round data while preserving room configuration and seats. */
function resetStoryRelayRound(state: StoryRelayState): StoryRelayState {
  return {
    ...state,
    phase: 'lobby',
    phaseRevision: state.phaseRevision + 1,
    roundId: null,
    startedAt: null,
    participants: [],
    seatOrder: [],
    stepOffsets: [],
    stepIndex: -1,
    deadlineAt: null,
    readySeats: [],
    chains: [],
    gallery: null,
    completedAt: null,
    abortedAt: null,
  };
}

/** Evolves a committed domain event without persistence or broadcasts. */
export function evolveStoryRelayState(
  state: StoryRelayState,
  event: StoryRelayEvent,
): StoryRelayState {
  switch (event.type) {
    case 'storyrelay.seats.changed': {
      const realSeats = { ...state.realSeats };
      for (const change of event.changes) {
        if (change.next === null) delete realSeats[change.seat];
        else realSeats[change.seat] = change.next;
      }
      return { ...state, realSeats, botSeats: event.botSeats };
    }
    case 'storyrelay.config.updated':
      return {
        ...state,
        config: event.config,
        botSeats: state.botSeats.filter((seat) => seat < event.config.numberOfPlayers),
      };
    case 'storyrelay.round.started':
      return {
        ...resetStoryRelayRound(state),
        ...event.round,
        phase: 'answering',
        stepIndex: 0,
        roundNumber: state.roundNumber + 1,
      };
    case 'storyrelay.task.ready':
      return {
        ...state,
        readySeats: event.isReady
          ? [...state.readySeats, event.seat]
          : state.readySeats.filter((seat) => seat !== event.seat),
      };
    case 'storyrelay.entries.appended':
      return {
        ...state,
        chains: state.chains.map((chain) => ({
          ...chain,
          entries: [
            ...chain.entries,
            ...event.entries.filter((item) => item.chainId === chain.id).map((item) => item.entry),
          ],
        })),
      };
    case 'storyrelay.phase.changed':
      return {
        ...state,
        phase: event.phase,
        stepIndex: event.stepIndex,
        deadlineAt: event.deadlineAt,
        gallery: event.gallery,
        phaseRevision: state.phaseRevision + 1,
        readySeats: [],
      };
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
      return resetStoryRelayRound(state);
  }
}
