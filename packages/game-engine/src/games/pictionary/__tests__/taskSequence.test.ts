/** Pictionary prompt-first sequence contracts through the public engine transition path. */

import type { CommandContext, CreateGameContext, Decision } from '../../../platform/engine';
import type { PictionaryCommand } from '../commands/types';
import type { PictionaryEvent } from '../domain/events';
import type { PictionaryEffect } from '../effects/types';
import { decidePictionaryCommand, pictionaryEngine } from '../engine';
import {
  DEFAULT_PICTIONARY_CONFIG,
  getPictionaryExpectedKind,
  getPictionaryRelayStepCount,
  getPictionaryTaskForSeat,
  type PictionaryState,
} from '../state/types';

const CREATE_CONTEXT: CreateGameContext = {
  roomCode: '2468',
  hostUserId: 'user-0',
  nowMs: 1_000,
  commandId: 'create-room',
};

function userContext(userId: string, nowMs = 2_000): CommandContext {
  return {
    actor: { kind: 'user', userId },
    controlledSeat: null,
    nowMs,
    commandId: `${userId}:${nowMs}`,
    randomSeed: 'pictionary-sequence-seed',
  };
}

function applyDecision(
  state: PictionaryState,
  decision: Decision<PictionaryEvent, PictionaryEffect>,
): PictionaryState {
  if (decision.kind !== 'commit') {
    throw new Error(`Expected committed Pictionary decision, received ${decision.reason}`);
  }
  let nextState = state;
  for (const event of decision.events) {
    nextState = pictionaryEngine.evolve(nextState, event);
  }
  return pictionaryEngine.normalize(nextState);
}

function dispatch(
  state: PictionaryState,
  command: PictionaryCommand,
  context: CommandContext,
): PictionaryState {
  return applyDecision(state, decidePictionaryCommand(state, command, context));
}

function createFullLobby(): PictionaryState {
  let state = pictionaryEngine.createInitialState(
    {
      ...DEFAULT_PICTIONARY_CONFIG,
      numberOfPlayers: 4,
      drawingDurationSeconds: 90,
      guessDurationSeconds: 30,
    },
    CREATE_CONTEXT,
  );
  for (let seat = 0; seat < 4; seat += 1) {
    state = dispatch(
      state,
      { type: 'room.seat.take', seat, profile: { displayName: `玩家 ${seat + 1}` } },
      userContext(`user-${seat}`, 2_000 + seat),
    );
  }
  return state;
}

function expireCurrentPhase(state: PictionaryState): PictionaryState {
  if (state.deadlineAt === null) {
    throw new Error(`Expected ${state.phase} to have a deadline`);
  }
  return dispatch(
    state,
    { type: 'pictionary.phase.expire', phaseRevision: state.phaseRevision },
    userContext('user-0', state.deadlineAt),
  );
}

function advancePastAnsweringStep(state: PictionaryState): PictionaryState {
  const transitionState = expireCurrentPhase(state);
  expect(transitionState.phase).toBe('transition');
  return expireCurrentPhase(transitionState);
}

describe('Pictionary task sequence', () => {
  it('alternates text and drawing for two stages per player', () => {
    expect(
      Array.from({ length: getPictionaryRelayStepCount(4) }, (_, stepIndex) =>
        getPictionaryExpectedKind(stepIndex),
      ),
    ).toEqual(['text', 'drawing', 'text', 'drawing', 'text', 'drawing', 'text', 'drawing']);
  });

  it('starts every player with a prompt task and the text deadline', () => {
    const startTime = 10_000;
    const state = dispatch(
      createFullLobby(),
      { type: 'pictionary.round.start' },
      userContext('user-0', startTime),
    );

    expect(state.phase).toBe('answering');
    expect(state.stepIndex).toBe(0);
    expect(state.deadlineAt).toBe(startTime + 30_000);
    for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
      expect(getPictionaryTaskForSeat(state, seat)).toMatchObject({
        expectedKind: 'text',
        previousEntry: null,
      });
    }
  });

  it('runs all eight four-player stages before starting the gallery', () => {
    let state = dispatch(
      createFullLobby(),
      { type: 'pictionary.round.start' },
      userContext('user-0', 10_000),
    );
    const relayStepCount = getPictionaryRelayStepCount(state.config.numberOfPlayers);
    const firstTaskChainId = getPictionaryTaskForSeat(state, 0)?.chain.id;

    for (let stepIndex = 0; stepIndex < relayStepCount; stepIndex += 1) {
      expect(state).toMatchObject({ phase: 'answering', stepIndex });
      const task = getPictionaryTaskForSeat(state, 0);
      expect(task?.expectedKind).toBe(getPictionaryExpectedKind(stepIndex));
      if (stepIndex === state.config.numberOfPlayers) {
        expect(task?.chain.id).toBe(firstTaskChainId);
        expect(task?.previousEntry).toMatchObject({
          kind: 'missed',
          expectedKind: 'drawing',
        });
      }
      state = advancePastAnsweringStep(state);
    }

    expect(state.phase).toBe('gallery');
    expect(state.chains).toHaveLength(4);
    expect(state.chains.every((chain) => chain.entries.length === relayStepCount)).toBe(true);
    expect(state.gallery).toMatchObject({ chainIndex: 0, entryIndex: 0 });

    const galleryEntryCount = state.config.numberOfPlayers * relayStepCount;
    for (let position = 1; position < galleryEntryCount; position += 1) {
      state = dispatch(
        state,
        { type: 'pictionary.gallery.advance' },
        userContext('user-0', 20_000 + position),
      );
      expect(state.gallery).toMatchObject({
        chainIndex: Math.floor(position / relayStepCount),
        entryIndex: position % relayStepCount,
      });
    }

    state = dispatch(
      state,
      { type: 'pictionary.gallery.advance' },
      userContext('user-0', 20_000 + galleryEntryCount),
    );
    expect(state.phase).toBe('ended');
  });
});
