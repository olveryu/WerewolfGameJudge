/** Pictionary drawing-first sequence contracts through the public engine transition path. */

import type { CommandContext, CreateGameContext, Decision } from '../../../platform/engine';
import type { PictionaryCommand } from '../commands/types';
import type { PictionaryEvent } from '../domain/events';
import type { PictionaryEffect } from '../effects/types';
import { decidePictionaryCommand, pictionaryEngine } from '../engine';
import {
  DEFAULT_PICTIONARY_CONFIG,
  getPictionaryExpectedKind,
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
    { ...DEFAULT_PICTIONARY_CONFIG, numberOfPlayers: 4, drawingDurationSeconds: 90 },
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

describe('Pictionary task sequence', () => {
  it('starts with free drawing and then alternates guessing and drawing', () => {
    expect(getPictionaryExpectedKind(0)).toBe('drawing');
    expect(getPictionaryExpectedKind(1)).toBe('text');
    expect(getPictionaryExpectedKind(2)).toBe('drawing');
  });

  it('starts every player with an unprompted drawing task and the drawing deadline', () => {
    const startTime = 10_000;
    const state = dispatch(
      createFullLobby(),
      { type: 'pictionary.round.start' },
      userContext('user-0', startTime),
    );

    expect(state.phase).toBe('answering');
    expect(state.stepIndex).toBe(0);
    expect(state.deadlineAt).toBe(startTime + 90_000);
    for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
      expect(getPictionaryTaskForSeat(state, seat)).toMatchObject({
        expectedKind: 'drawing',
        previousEntry: null,
      });
    }
  });
});
