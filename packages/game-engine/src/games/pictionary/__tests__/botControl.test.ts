/** Pictionary implicit bot seating and controlled-seat authorization contracts. */

import type { CommandContext, CreateGameContext, Decision } from '../../../platform/engine';
import {
  REASON_CONTROLLED_SEAT_NOT_BOT,
  REASON_NOT_HOST,
} from '../../../platform/protocol/reasons';
import type { PictionaryCommand } from '../commands/types';
import type { PictionaryEvent } from '../domain/events';
import type { PictionaryEffect } from '../effects/types';
import { decidePictionaryCommand, pictionaryEngine } from '../engine';
import {
  DEFAULT_PICTIONARY_CONFIG,
  getPictionaryExpectedKind,
  getPictionaryOccupiedSeatCount,
  isPictionaryImplicitBotSeat,
  type PictionaryState,
} from '../state/types';

const CREATE_CONTEXT: CreateGameContext = {
  roomCode: '2468',
  hostUserId: 'host',
  nowMs: 1_000,
  commandId: 'create-room',
};

function userContext(
  userId: string,
  controlledSeat: number | null = null,
  nowMs = 2_000,
): CommandContext {
  return {
    actor: { kind: 'user', userId },
    controlledSeat,
    nowMs,
    commandId: `${userId}:${controlledSeat ?? 'self'}:${nowMs}`,
    randomSeed: 'pictionary-bot-seed',
  };
}

function applyDecision(
  state: PictionaryState,
  decision: Decision<PictionaryEvent, PictionaryEffect>,
): PictionaryState {
  if (decision.kind !== 'commit') {
    throw new Error(`Expected committed Pictionary decision, received ${decision.reason}`);
  }
  return decision.events.reduce(
    (nextState, event) => pictionaryEngine.normalize(pictionaryEngine.evolve(nextState, event)),
    state,
  );
}

function dispatch(
  state: PictionaryState,
  command: PictionaryCommand,
  context: CommandContext,
): PictionaryState {
  return applyDecision(state, decidePictionaryCommand(state, command, context));
}

function createBotRound(): PictionaryState {
  let state = pictionaryEngine.createInitialState(
    { ...DEFAULT_PICTIONARY_CONFIG, numberOfPlayers: 4 },
    CREATE_CONTEXT,
  );
  state = dispatch(
    state,
    { type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } },
    userContext('host'),
  );
  state = dispatch(state, { type: 'room.seat.fillBots' }, userContext('host'));
  return dispatch(state, { type: 'pictionary.round.start' }, userContext('host'));
}

function markEverySeatReady(state: PictionaryState): PictionaryState {
  let nextState = state;
  for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
    nextState = dispatch(
      nextState,
      { type: 'pictionary.task.ready.set', isReady: true },
      userContext('host', seat === 0 && state.realSeats[0] !== undefined ? null : seat),
    );
  }
  return nextState;
}

function advanceToDrawingCollection(state: PictionaryState): PictionaryState {
  let nextState = markEverySeatReady(state);
  for (let seat = 0; seat < state.config.numberOfPlayers; seat += 1) {
    nextState = dispatch(
      nextState,
      { type: 'pictionary.text.submit', text: `题目 ${seat + 1}` },
      userContext('host', seat === 0 && state.realSeats[0] !== undefined ? null : seat),
    );
  }
  if (nextState.deadlineAt === null) throw new Error('Pictionary transition deadline is missing');
  nextState = dispatch(
    nextState,
    { type: 'pictionary.phase.expire', phaseRevision: nextState.phaseRevision },
    userContext('host', null, nextState.deadlineAt),
  );
  nextState = markEverySeatReady(nextState);
  expect(nextState.phase).toBe('settling');
  expect(getPictionaryExpectedKind(nextState.stepIndex)).toBe('drawing');
  return nextState;
}

function expireCurrentPhase(state: PictionaryState): PictionaryState {
  if (state.deadlineAt === null) throw new Error('Pictionary phase deadline is missing');
  return dispatch(
    state,
    { type: 'pictionary.phase.expire', phaseRevision: state.phaseRevision },
    userContext('host', null, state.deadlineAt),
  );
}

describe('Pictionary bot control', () => {
  it('fills empty lobby seats with implicit bots', () => {
    const state = createBotRound();

    expect(getPictionaryOccupiedSeatCount(state)).toBe(4);
    expect(isPictionaryImplicitBotSeat(state, 1)).toBe(true);
    expect(isPictionaryImplicitBotSeat(state, 0)).toBe(false);
  });

  it('rejects bot filling from a non-host user', () => {
    const state = pictionaryEngine.createInitialState(
      { ...DEFAULT_PICTIONARY_CONFIG, numberOfPlayers: 4 },
      CREATE_CONTEXT,
    );

    expect(
      decidePictionaryCommand(state, { type: 'room.seat.fillBots' }, userContext('guest')),
    ).toEqual({ kind: 'reject', reason: REASON_NOT_HOST });
  });

  it('clears real seats and disables implicit bot filling together', () => {
    let state = pictionaryEngine.createInitialState(
      { ...DEFAULT_PICTIONARY_CONFIG, numberOfPlayers: 4 },
      CREATE_CONTEXT,
    );
    state = dispatch(
      state,
      { type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } },
      userContext('host'),
    );
    state = dispatch(state, { type: 'room.seat.fillBots' }, userContext('host'));
    state = dispatch(state, { type: 'room.seat.clear' }, userContext('host'));

    expect(state.realSeats).toEqual({});
    expect(state.fillEmptySeatsWithBots).toBe(false);
    expect(state.excludedBotSeats).toEqual([]);
    expect(getPictionaryOccupiedSeatCount(state)).toBe(0);
  });

  it('allows the host to reserve a drawing for a controlled bot seat', () => {
    const state = advanceToDrawingCollection(createBotRound());
    const decision = decidePictionaryCommand(
      state,
      { type: 'pictionary.drawing.reserve' },
      userContext('host', 1),
    );

    expect(decision).toMatchObject({
      kind: 'commit',
      events: [{ type: 'pictionary.drawing.reserved', reservation: { authorSeat: 1 } }],
    });
  });

  it('rejects controlled bot submissions from a non-host user', () => {
    const decision = decidePictionaryCommand(
      advanceToDrawingCollection(createBotRound()),
      { type: 'pictionary.drawing.reserve' },
      userContext('guest', 1),
    );

    expect(decision).toEqual({ kind: 'reject', reason: REASON_NOT_HOST });
  });

  it('rejects controlling a real player seat', () => {
    const decision = decidePictionaryCommand(
      advanceToDrawingCollection(createBotRound()),
      { type: 'pictionary.drawing.reserve' },
      userContext('host', 0),
    );

    expect(decision).toEqual({ kind: 'reject', reason: REASON_CONTROLLED_SEAT_NOT_BOT });
  });

  it('allows an unseated host to advance an all-bot room after takeover is released', () => {
    let state = pictionaryEngine.createInitialState(
      { ...DEFAULT_PICTIONARY_CONFIG, numberOfPlayers: 4 },
      CREATE_CONTEXT,
    );
    state = dispatch(state, { type: 'room.seat.fillBots' }, userContext('host'));
    state = dispatch(state, { type: 'pictionary.round.start' }, userContext('host'));

    state = expireCurrentPhase(state);
    expect(state.phase).toBe('settling');
    state = expireCurrentPhase(state);
    expect(state.phase).toBe('transition');
    state = expireCurrentPhase(state);

    expect(state.phase).toBe('answering');
    expect(state.stepIndex).toBe(1);
    expect(getPictionaryExpectedKind(state.stepIndex)).toBe('drawing');
  });
});
