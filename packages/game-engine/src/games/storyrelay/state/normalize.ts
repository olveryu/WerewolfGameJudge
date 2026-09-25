/** Story Relay semantic invariants; invalid persisted or evolved states fail explicitly. */

import {
  isValidStoryRelayConfig,
  STORY_RELAY_GAME_TYPE,
  STORY_RELAY_STATE_VERSION,
  STORY_RELAY_TEXT_MAX_LENGTH,
  type StoryRelayState,
} from './types';

function invariant(condition: boolean, message: string): asserts condition {
  if (!condition) throw new Error(`Invalid Story Relay state: ${message}`);
}

/** Validates authoritative state without repairing or dropping submitted stories. */
export function normalizeStoryRelayState(state: StoryRelayState): StoryRelayState {
  invariant(
    state.gameType === STORY_RELAY_GAME_TYPE && state.stateVersion === STORY_RELAY_STATE_VERSION,
    'identity',
  );
  invariant(isValidStoryRelayConfig(state.config), 'configuration');
  const count = state.config.numberOfPlayers;
  const isSeat = (seat: number) => Number.isSafeInteger(seat) && seat >= 0 && seat < count;
  invariant(
    Number.isSafeInteger(state.phaseRevision) && state.phaseRevision >= 0,
    'phase revision',
  );
  invariant(Number.isSafeInteger(state.roundNumber) && state.roundNumber >= 0, 'round number');
  invariant(
    state.deadlineAt === null || (Number.isSafeInteger(state.deadlineAt) && state.deadlineAt >= 0),
    'deadline',
  );
  const users = Object.entries(state.realSeats);
  invariant(
    users.every(
      ([seat, occupant]) =>
        occupant !== undefined &&
        isSeat(Number(seat)) &&
        occupant.seat === Number(seat) &&
        occupant.profile.displayName.trim().length > 0,
    ),
    'real seats',
  );
  invariant(
    new Set(users.map(([, occupant]) => occupant!.userId)).size === users.length,
    'duplicate user',
  );
  invariant(
    state.botSeats.every((seat) => isSeat(seat) && state.realSeats[seat] === undefined) &&
      new Set(state.botSeats).size === state.botSeats.length,
    'bot seats',
  );
  invariant(
    state.readySeats.every(isSeat) && new Set(state.readySeats).size === state.readySeats.length,
    'readiness',
  );
  if (state.phase === 'lobby') {
    invariant(
      state.roundId === null &&
        state.startedAt === null &&
        state.stepIndex === -1 &&
        state.chains.length === 0 &&
        state.participants.length === 0 &&
        state.seatOrder.length === 0 &&
        state.stepOffsets.length === 0,
      'lobby round data',
    );
    invariant(
      state.deadlineAt === null &&
        state.gallery === null &&
        state.completedAt === null &&
        state.abortedAt === null &&
        state.readySeats.length === 0,
      'lobby progress',
    );
    return state;
  }
  invariant(state.roundId !== null && state.roundNumber > 0, 'round identity');
  invariant(
    state.startedAt !== null && Number.isSafeInteger(state.startedAt) && state.startedAt >= 0,
    'start time',
  );
  invariant(users.length + state.botSeats.length === count, 'occupied seats');
  invariant(
    state.participants.length === count &&
      new Set(state.participants.map((participant) => participant.seat)).size === count &&
      state.participants.every(
        (participant) =>
          isSeat(participant.seat) &&
          participant.displayName.trim().length > 0 &&
          (participant.userId === null
            ? state.botSeats.includes(participant.seat)
            : state.realSeats[participant.seat]?.userId === participant.userId),
      ),
    'participants',
  );
  invariant(
    state.seatOrder.length === count &&
      state.seatOrder.every(isSeat) &&
      new Set(state.seatOrder).size === count,
    'seat order',
  );
  invariant(
    state.stepOffsets.length === count &&
      state.stepOffsets[0] === 0 &&
      state.stepOffsets.every(isSeat) &&
      new Set(state.stepOffsets).size === count,
    'offsets',
  );
  invariant(
    Number.isSafeInteger(state.stepIndex) && state.stepIndex >= 0 && state.stepIndex < count,
    'step index',
  );
  invariant(
    state.chains.length === count && new Set(state.chains.map((chain) => chain.id)).size === count,
    'chains',
  );
  const entryIds = new Set<string>();
  state.chains.forEach((chain, chainIndex) => {
    invariant(chain.originSeat === state.seatOrder[chainIndex], 'origin');
    invariant(
      chain.entries.length >= state.stepIndex && chain.entries.length <= state.stepIndex + 1,
      'entry progress',
    );
    if (state.phase === 'answering')
      invariant(chain.entries.length === state.stepIndex, 'answering entries');
    if (['transition', 'gallery', 'ended'].includes(state.phase))
      invariant(chain.entries.length === state.stepIndex + 1, 'settled entries');
    chain.entries.forEach((entry, entryIndex) => {
      invariant(
        entry.authorSeat === state.seatOrder[(chainIndex + state.stepOffsets[entryIndex]!) % count],
        'author',
      );
      invariant(!entryIds.has(entry.id), 'duplicate entry');
      entryIds.add(entry.id);
      invariant(
        Number.isSafeInteger(entry.submittedAt) && entry.submittedAt >= 0,
        'submitted time',
      );
      if (entry.kind === 'text')
        invariant(
          entry.text.trim().length > 0 && entry.text.length <= STORY_RELAY_TEXT_MAX_LENGTH,
          'text',
        );
    });
  });
  if (state.phase !== 'answering')
    invariant(state.readySeats.length === 0, 'readiness outside answering');
  if (state.phase === 'settling' || state.phase === 'aborted' || state.phase === 'ended')
    invariant(state.deadlineAt === null, 'untimed phase');
  const isComplete =
    state.stepIndex === count - 1 && state.chains.every((chain) => chain.entries.length === count);
  invariant((state.completedAt !== null) === isComplete, 'completion');
  invariant(
    (state.abortedAt !== null) === (state.phase === 'aborted') &&
      !(state.abortedAt !== null && isComplete),
    'abort',
  );
  if (state.phase === 'gallery' || state.phase === 'ended') {
    invariant(isComplete && state.gallery !== null, 'gallery requires completed round');
    invariant(
      Number.isSafeInteger(state.gallery.position) &&
        state.gallery.position >= 0 &&
        state.gallery.position <= state.gallery.revealedPosition &&
        Number.isSafeInteger(state.gallery.revealedPosition) &&
        state.gallery.revealedPosition < count * count,
      'gallery position',
    );
  } else invariant(state.gallery === null, 'unexpected gallery');
  return state;
}
