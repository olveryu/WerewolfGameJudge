/**
 * Identity Viewing Protocol — FibKing scenario contract (P-1 batch D).
 *
 * The same scenario names run in every dealing game's contract file so
 * the protocol semantics cannot drift: record + idempotent mark +
 * human-only checkpoint + per-viewer projection.
 */

import type { CommandContext, CreateGameContext, Decision } from '../../../platform/engine';
import { REASON_NOT_HOST } from '../../../platform/protocol/reasons';
import type { FibCommand } from '../commands/types';
import type { FibEvent } from '../domain/events';
import { REASON_FIB_ROUND_NOT_ONGOING, REASON_FIB_ROUND_NOT_VIEWING } from '../domain/reasons';
import { getFibRoundView } from '../domain/visibility';
import type { FibEffect } from '../effects/types';
import { decideFibCommand, fibEngine } from '../engine';
import { migratePersistedFibState, parseFibState } from '../state/parseState';
import { FIB_PREPARATION_STAGES, type FibState } from '../state/types';

const CREATE_CONTEXT: CreateGameContext = {
  roomCode: '4321',
  hostUserId: 'host',
  nowMs: 1_000,
  commandId: 'create-1',
};

function userContext(
  userId: string,
  options: { readonly controlledSeat?: number | null } = {},
): CommandContext {
  return {
    actor: { kind: 'user', userId },
    controlledSeat: options.controlledSeat ?? null,
    nowMs: 2_000,
    commandId: 'command-1',
    randomSeed: 'seed-1',
  };
}

function systemContext(): CommandContext {
  return {
    actor: { kind: 'system', effectId: 'effect-1' },
    controlledSeat: null,
    nowMs: 2_100,
    commandId: 'effect-command-1',
    randomSeed: 'role-seed-1',
  };
}

function applyDecision(state: FibState, decision: Decision<FibEvent, FibEffect>): FibState {
  if (decision.kind !== 'commit') {
    throw new Error(`Expected committed Fib decision, received ${decision.reason}`);
  }
  let nextState = state;
  for (const event of decision.events) {
    nextState = fibEngine.evolve(nextState, event);
  }
  return fibEngine.normalize(nextState);
}

function dispatch(state: FibState, command: FibCommand, context: CommandContext): FibState {
  return applyDecision(state, decideFibCommand(state, command, context));
}

function takeSeat(state: FibState, seat: number, userId: string): FibState {
  return dispatch(
    state,
    { type: 'room.seat.take', seat, profile: { displayName: userId } },
    userContext(userId),
  );
}

/** Three humans (seats 0-2) plus one implicit bot (seat 3). */
function createRoom(): FibState {
  let state = fibEngine.createInitialState({ numberOfPlayers: 4 }, CREATE_CONTEXT);
  state = takeSeat(state, 0, 'host');
  state = takeSeat(state, 1, 'alice');
  state = takeSeat(state, 2, 'bob');
  return dispatch(state, { type: 'room.seat.fillBots' }, userContext('host'));
}

function dealRound(state: FibState, commandId = 'round-1', word = '云朵'): FibState {
  let next = dispatch(state, { type: 'fib.round.start' }, { ...userContext('host'), commandId });
  if (next.phase !== 'preparing') throw new Error('Expected preparing state');
  const { roundId } = next.pendingRound;
  next = dispatch(
    next,
    { type: 'fib.round.updatePreparationStage', roundId, stage: FIB_PREPARATION_STAGES.selecting },
    systemContext(),
  );
  if (next.phase !== 'preparing') throw new Error('Expected preparing state');
  next = dispatch(
    next,
    { type: 'fib.round.updatePreparationStage', roundId, stage: FIB_PREPARATION_STAGES.finalizing },
    systemContext(),
  );
  if (next.phase !== 'preparing') throw new Error('Expected preparing state');
  return dispatch(
    next,
    {
      type: 'fib.round.complete',
      roundId,
      word,
      definition: {
        coreMeaning: '悬浮在空中的水滴或冰晶集合。',
        usageNote: '常用于说明该词所指事物的具体含义和适用语境。',
      },
      source: 'local',
    },
    systemContext(),
  );
}

function confirm(state: FibState, userId: string): FibState {
  return dispatch(state, { type: 'fib.round.confirmRoleView' }, userContext(userId));
}

describe('identity viewing protocol (fibking)', () => {
  it('records each human confirming their own seat, idempotently', () => {
    const viewing = dealRound(createRoom());
    if (viewing.phase !== 'viewing') throw new Error('Expected viewing state');
    expect(viewing.round.viewedSeats).toEqual([3]);

    const once = confirm(viewing, 'alice');
    if (once.phase !== 'viewing') throw new Error('Expected viewing state');
    expect(once.round.viewedSeats).toEqual([1, 3]);
    const view = getFibRoundView(once, 1);
    expect(view).toMatchObject({ phase: 'viewing', viewerHasViewed: true });
    expect(getFibRoundView(once, 0)).toMatchObject({ viewerHasViewed: false });

    const twice = decideFibCommand(
      once,
      { type: 'fib.round.confirmRoleView' },
      userContext('alice'),
    );
    expect(twice.kind).toBe('commit');
    if (twice.kind === 'commit') {
      expect(twice.events).toEqual([]);
      expect(twice.effects).toEqual([]);
    }

    const takeover = decideFibCommand(
      once,
      { type: 'fib.round.confirmRoleView' },
      userContext('alice', { controlledSeat: 3 }),
    );
    expect(takeover).toEqual({ kind: 'reject', reason: REASON_NOT_HOST });
    const hostForBot = decideFibCommand(
      once,
      { type: 'fib.round.confirmRoleView' },
      userContext('host', { controlledSeat: 3 }),
    );
    expect(hostForBot.kind).toBe('commit');
    if (hostForBot.kind === 'commit') expect(hostForBot.events).toEqual([]);
  });

  it('blocks the round until every human has viewed, then starts', () => {
    const viewing = dealRound(createRoom());
    expect(decideFibCommand(viewing, { type: 'fib.round.reveal' }, userContext('host'))).toEqual({
      kind: 'reject',
      reason: REASON_FIB_ROUND_NOT_ONGOING,
    });

    const two = confirm(confirm(viewing, 'host'), 'alice');
    if (two.phase !== 'viewing') throw new Error('Round started before every human viewed');
    expect(getFibRoundView(two, 0)).toMatchObject({ unviewedSeats: [2] });

    const lastDecision = decideFibCommand(
      two,
      { type: 'fib.round.confirmRoleView' },
      userContext('bob'),
    );
    if (lastDecision.kind !== 'commit') throw new Error('Expected commit');
    expect(lastDecision.events.map((event) => event.type)).toEqual([
      'fib.role.viewed',
      'fib.round.viewingCompleted',
    ]);
    const ongoing = applyDecision(two, lastDecision);
    expect(ongoing.phase).toBe('ongoing');
    expect(
      decideFibCommand(ongoing, { type: 'fib.round.confirmRoleView' }, userContext('bob')),
    ).toEqual({ kind: 'reject', reason: REASON_FIB_ROUND_NOT_VIEWING });
  });

  it('resets the viewing record on every new round', () => {
    let state = dealRound(createRoom());
    state = confirm(confirm(confirm(state, 'host'), 'alice'), 'bob');
    state = dispatch(state, { type: 'fib.round.reveal' }, userContext('host'));
    const nextRound = dealRound(state, 'round-2', '灯塔');
    if (nextRound.phase !== 'viewing') throw new Error('Expected viewing state');
    expect(nextRound.round.viewedSeats).toEqual([3]);
    expect(getFibRoundView(nextRound, 0)).toMatchObject({
      viewerHasViewed: false,
      unviewedSeats: [0, 1, 2],
    });
  });

  it('rejects viewing confirmation outside the viewing phase', () => {
    expect(
      decideFibCommand(createRoom(), { type: 'fib.round.confirmRoleView' }, userContext('host')),
    ).toEqual({ kind: 'reject', reason: REASON_FIB_ROUND_NOT_VIEWING });
  });

  it('migrates v5 rooms: in-flight rounds count as fully viewed', () => {
    const viewing = dealRound(createRoom());
    const serialized = JSON.parse(JSON.stringify(viewing)) as Record<string, unknown>;
    const round = serialized.round as Record<string, unknown>;
    delete round.viewedSeats;
    serialized.stateVersion = 5;
    serialized.phase = 'ongoing';

    const migrated = migratePersistedFibState(serialized);
    if (migrated.phase !== 'ongoing') throw new Error('Expected ongoing state');
    expect(migrated.round.viewedSeats).toEqual([0, 1, 2, 3]);
    expect(parseFibState(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated);

    const lobby = JSON.parse(
      JSON.stringify(fibEngine.createInitialState({ numberOfPlayers: 4 }, CREATE_CONTEXT)),
    ) as Record<string, unknown>;
    lobby.stateVersion = 5;
    expect(migratePersistedFibState(lobby).phase).toBe('lobby');

    let ended = dealRound(createRoom());
    ended = confirm(confirm(confirm(ended, 'host'), 'alice'), 'bob');
    ended = dispatch(ended, { type: 'fib.round.reveal' }, userContext('host'));
    const endedSerialized = JSON.parse(JSON.stringify(ended)) as Record<string, unknown>;
    delete (endedSerialized.round as Record<string, unknown>).viewedSeats;
    endedSerialized.stateVersion = 5;
    const migratedEnded = migratePersistedFibState(endedSerialized);
    if (migratedEnded.phase !== 'ended') throw new Error('Expected ended state');
    expect(migratedEnded.round.viewedSeats).toEqual([0, 1, 2, 3]);
  });
});
