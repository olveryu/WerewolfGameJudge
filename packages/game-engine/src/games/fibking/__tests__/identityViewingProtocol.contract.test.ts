/**
 * Identity Viewing Protocol — FibKing scenario contract (P-1 batch D).
 *
 * The same scenario names run in every dealing game's contract file so
 * the protocol semantics cannot drift: record + idempotent mark +
 * strict checkpoint (every seat counts; bot records come from the
 * host's scaffold action) + per-viewer projection.
 */

import type { CommandContext, CreateGameContext, Decision } from '../../../platform/engine';
import { REASON_NOT_HOST } from '../../../platform/protocol/reasons';
import { describeIdentityViewingProtocol } from '../../../platform/room/__tests__/identityViewingScenarios';
import type { FibCommand } from '../commands/types';
import type { FibEvent } from '../domain/events';
import {
  REASON_FIB_NOT_ALL_VIEWED,
  REASON_FIB_ROUND_NOT_ONGOING,
  REASON_FIB_ROUND_NOT_VIEWING,
} from '../domain/reasons';
import { getFibRoundView } from '../domain/visibility';
import type { FibEffect } from '../effects/types';
import { decideFibCommand, fibEngine } from '../engine';
import { migratePersistedFibState, parseFibState } from '../state/parseState';
import { getFibViewingParticipants } from '../state/types';
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
/** Rebuilds a genuine pre-roster document (trio fields) from a current state. */
function downgradeRoster(state: FibState): Record<string, unknown> {
  const raw = JSON.parse(JSON.stringify(state)) as Record<string, unknown>;
  const roster = raw.roster as Record<string, { userId?: string }>;
  delete raw.roster;
  const realSeats: Record<string, unknown> = {};
  const excludedBotSeats: number[] = [];
  let hasBots = false;
  const count = state.numberOfPlayers;
  for (let seat = 0; seat < count; seat += 1) {
    const occupant = roster[String(seat)];
    if (occupant?.userId !== undefined) realSeats[String(seat)] = occupant;
    else if (occupant !== undefined) hasBots = true;
    else excludedBotSeats.push(seat);
  }
  return {
    ...raw,
    realSeats,
    fillEmptySeatsWithBots: hasBots,
    excludedBotSeats: hasBots ? excludedBotSeats : [],
  };
}

function createRoom(): FibState {
  let state = fibEngine.createInitialState({ numberOfPlayers: 4 }, CREATE_CONTEXT);
  state = takeSeat(state, 0, 'host');
  state = takeSeat(state, 1, 'alice');
  state = takeSeat(state, 2, 'bob');
  return dispatch(state, { type: 'room.seat.fillBots' }, userContext('host'));
}

function dealRound(state: FibState, commandId = 'round-1', word = '云朵'): FibState {
  let next = dispatch(
    state,
    { type: 'fibking.round.start' },
    { ...userContext('host'), commandId },
  );
  if (next.phase !== 'preparing') throw new Error('Expected preparing state');
  const { roundId } = next.pendingRound;
  next = dispatch(
    next,
    {
      type: 'fibking.round.updatePreparationStage',
      roundId,
      stage: FIB_PREPARATION_STAGES.selecting,
    },
    systemContext(),
  );
  if (next.phase !== 'preparing') throw new Error('Expected preparing state');
  next = dispatch(
    next,
    {
      type: 'fibking.round.updatePreparationStage',
      roundId,
      stage: FIB_PREPARATION_STAGES.finalizing,
    },
    systemContext(),
  );
  if (next.phase !== 'preparing') throw new Error('Expected preparing state');
  return dispatch(
    next,
    {
      type: 'fibking.round.complete',
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
  return dispatch(state, { type: 'fibking.round.confirmRoleView' }, userContext(userId));
}

describe('identity viewing protocol (fibking)', () => {
  it('records each human confirming their own seat, idempotently', () => {
    const viewing = dealRound(createRoom());
    if (viewing.phase !== 'viewing') throw new Error('Expected viewing state');
    expect(viewing.round.viewedSeats).toEqual([]);

    const once = confirm(viewing, 'alice');
    if (once.phase !== 'viewing') throw new Error('Expected viewing state');
    expect(once.round.viewedSeats).toEqual([1]);
    const view = getFibRoundView(once, 1);
    expect(view).toMatchObject({ phase: 'viewing', viewerHasViewed: true });
    expect(getFibRoundView(once, 0)).toMatchObject({ viewerHasViewed: false });

    const twice = decideFibCommand(
      once,
      { type: 'fibking.round.confirmRoleView' },
      userContext('alice'),
    );
    expect(twice.kind).toBe('commit');
    if (twice.kind === 'commit') {
      expect(twice.events).toEqual([]);
      expect(twice.effects).toEqual([]);
    }

    const takeover = decideFibCommand(
      once,
      { type: 'fibking.round.confirmRoleView' },
      userContext('alice', { controlledSeat: 3 }),
    );
    expect(takeover).toEqual({ kind: 'reject', reason: REASON_NOT_HOST });
    const hostForBot = decideFibCommand(
      once,
      { type: 'fibking.round.confirmRoleView' },
      userContext('host', { controlledSeat: 3 }),
    );
    expect(hostForBot.kind).toBe('commit');
    if (hostForBot.kind === 'commit')
      expect(hostForBot.events).toEqual([{ type: 'fibking.role.viewed', seat: 3 }]);
  });

  it('holds viewing until every seat has viewed and the host begins', () => {
    const viewing = dealRound(createRoom());
    expect(
      decideFibCommand(viewing, { type: 'fibking.round.reveal' }, userContext('host')),
    ).toEqual({
      kind: 'reject',
      reason: REASON_FIB_ROUND_NOT_ONGOING,
    });
    // The begin gate is closed while any seat is unviewed.
    expect(decideFibCommand(viewing, { type: 'fibking.round.begin' }, userContext('host'))).toEqual(
      { kind: 'reject', reason: REASON_FIB_NOT_ALL_VIEWED },
    );

    const two = confirm(confirm(viewing, 'host'), 'alice');
    if (two.phase !== 'viewing') throw new Error('Round started before every seat viewed');
    expect(getFibRoundView(two, 0)).toMatchObject({ unviewedSeats: [2, 3] });

    // The last human viewing does not complete the phase: the bot
    // seat's record is still open and no completion event exists.
    const bobDecision = decideFibCommand(
      two,
      { type: 'fibking.round.confirmRoleView' },
      userContext('bob'),
    );
    if (bobDecision.kind !== 'commit') throw new Error('Expected commit');
    expect(bobDecision.events.map((event) => event.type)).toEqual(['fibking.role.viewed']);
    const allHumans = applyDecision(two, bobDecision);
    expect(allHumans.phase).toBe('viewing');
    expect(
      decideFibCommand(allHumans, { type: 'fibking.round.begin' }, userContext('host')),
    ).toEqual({ kind: 'reject', reason: REASON_FIB_NOT_ALL_VIEWED });

    // Non-hosts cannot run the scaffold action.
    expect(
      decideFibCommand(allHumans, { type: 'fibking.bots.markAllBotsViewed' }, userContext('alice')),
    ).toEqual({ kind: 'reject', reason: REASON_NOT_HOST });

    const markDecision = decideFibCommand(
      allHumans,
      { type: 'fibking.bots.markAllBotsViewed' },
      userContext('host'),
    );
    if (markDecision.kind !== 'commit') throw new Error('Expected commit');
    expect(markDecision.events.map((event) => event.type)).toEqual(['fibking.role.viewed']);
    const allViewed = applyDecision(allHumans, markDecision);
    // Every seat has viewed, but play opens only on the host's begin.
    expect(allViewed.phase).toBe('viewing');

    expect(
      decideFibCommand(allViewed, { type: 'fibking.round.begin' }, userContext('alice')),
    ).toEqual({ kind: 'reject', reason: REASON_NOT_HOST });
    const beginDecision = decideFibCommand(
      allViewed,
      { type: 'fibking.round.begin' },
      userContext('host'),
    );
    if (beginDecision.kind !== 'commit') throw new Error('Expected commit');
    expect(beginDecision.events.map((event) => event.type)).toEqual(['fibking.round.begun']);
    const ongoing = applyDecision(allViewed, beginDecision);
    expect(ongoing.phase).toBe('ongoing');
    // D-2: bob's record already exists, so his late confirmation is an
    // idempotent empty success even after the stage flipped — the
    // shared confirm skeleton checks the record before the phase
    // policy. (Begin in the wrong phase still rejects.)
    const lateDecision = decideFibCommand(
      ongoing,
      { type: 'fibking.round.confirmRoleView' },
      userContext('bob'),
    );
    if (lateDecision.kind !== 'commit') throw new Error('Expected commit');
    expect(lateDecision.events).toEqual([]);
    expect(decideFibCommand(ongoing, { type: 'fibking.round.begin' }, userContext('host'))).toEqual(
      { kind: 'reject', reason: REASON_FIB_ROUND_NOT_VIEWING },
    );
  });

  it('rejects a confirmation for an unviewed seat outside the viewing stage', () => {
    expect(
      decideFibCommand(
        createRoom(),
        { type: 'fibking.round.confirmRoleView' },
        userContext('host'),
      ),
    ).toEqual({ kind: 'reject', reason: REASON_FIB_ROUND_NOT_VIEWING });
  });

  it('lets the host confirm a bot seat under takeover so the begin gate opens', () => {
    let state = dealRound(createRoom());
    if (state.phase !== 'viewing') throw new Error('Expected viewing state');
    state = confirm(confirm(confirm(state, 'host'), 'alice'), 'bob');
    // The host views the bot seat's card under takeover and confirms
    // for it (the client passes the controlled seat explicitly).
    state = dispatch(
      state,
      { type: 'fibking.round.confirmRoleView' },
      userContext('host', { controlledSeat: 3 }),
    );
    if (state.phase !== 'viewing') throw new Error('Expected viewing state');
    expect(state.round.viewedSeats).toEqual([0, 1, 2, 3]);
    const beginDecision = decideFibCommand(
      state,
      { type: 'fibking.round.begin' },
      userContext('host'),
    );
    if (beginDecision.kind !== 'commit') throw new Error('Expected commit');
    expect(beginDecision.events.map((event) => event.type)).toEqual(['fibking.round.begun']);
  });

  it('resets the viewing record on every new round', () => {
    let state = dealRound(createRoom());
    state = confirm(confirm(confirm(state, 'host'), 'alice'), 'bob');
    state = dispatch(state, { type: 'fibking.bots.markAllBotsViewed' }, userContext('host'));
    state = dispatch(state, { type: 'fibking.round.begin' }, userContext('host'));
    state = dispatch(state, { type: 'fibking.round.reveal' }, userContext('host'));
    const nextRound = dealRound(state, 'round-2', '灯塔');
    if (nextRound.phase !== 'viewing') throw new Error('Expected viewing state');
    expect(nextRound.round.viewedSeats).toEqual([]);
    expect(getFibRoundView(nextRound, 0)).toMatchObject({
      viewerHasViewed: false,
      unviewedSeats: [0, 1, 2, 3],
    });
  });

  it('rejects viewing confirmation outside the viewing phase', () => {
    expect(
      decideFibCommand(
        createRoom(),
        { type: 'fibking.round.confirmRoleView' },
        userContext('host'),
      ),
    ).toEqual({ kind: 'reject', reason: REASON_FIB_ROUND_NOT_VIEWING });
  });

  it('migrates v5 rooms: in-flight rounds count as fully viewed', () => {
    const viewing = dealRound(createRoom());
    const serialized = downgradeRoster(viewing);
    const round = serialized.round as Record<string, unknown>;
    delete round.viewedSeats;
    serialized.stateVersion = 5;
    serialized.phase = 'ongoing';

    const migrated = migratePersistedFibState(serialized);
    if (migrated.phase !== 'ongoing') throw new Error('Expected ongoing state');
    expect(migrated.round.viewedSeats).toEqual([0, 1, 2, 3]);
    expect(migrated.round.guesses).toEqual([]);
    expect(parseFibState(JSON.parse(JSON.stringify(migrated)))).toEqual(migrated);

    const lobby = downgradeRoster(
      fibEngine.createInitialState({ numberOfPlayers: 4 }, CREATE_CONTEXT),
    );
    lobby.stateVersion = 5;
    expect(migratePersistedFibState(lobby).phase).toBe('lobby');

    let ended = dealRound(createRoom());
    ended = confirm(confirm(confirm(ended, 'host'), 'alice'), 'bob');
    ended = dispatch(ended, { type: 'fibking.bots.markAllBotsViewed' }, userContext('host'));
    ended = dispatch(ended, { type: 'fibking.round.begin' }, userContext('host'));
    ended = dispatch(ended, { type: 'fibking.round.reveal' }, userContext('host'));
    const endedSerialized = downgradeRoster(ended);
    delete (endedSerialized.round as Record<string, unknown>).viewedSeats;
    endedSerialized.stateVersion = 5;
    const migratedEnded = migratePersistedFibState(endedSerialized);
    if (migratedEnded.phase !== 'ended') throw new Error('Expected ended state');
    expect(migratedEnded.round.viewedSeats).toEqual([0, 1, 2, 3]);
  });
});

describeIdentityViewingProtocol({
  game: 'fibking',
  makeSession: () => {
    let state = dealRound(createRoom());
    const users: Readonly<Record<number, string>> = { 0: 'host', 1: 'alice', 2: 'bob' };
    const attempt = (command: FibCommand, context: CommandContext) => {
      const decision = decideFibCommand(state, command, context);
      if (decision.kind === 'commit') state = applyDecision(state, decision);
    };
    return {
      viewedSeats: () => (state.round === null ? [] : state.round.viewedSeats),
      participants: () => getFibViewingParticipants(state),
      view: (seat) => {
        if (users[seat] !== undefined) {
          attempt({ type: 'fibking.round.confirmRoleView' }, userContext(users[seat]));
        } else {
          // Bot seats view through the host's takeover confirmation.
          attempt(
            { type: 'fibking.round.confirmRoleView' },
            userContext('host', { controlledSeat: seat }),
          );
        }
      },
      markAllBotsViewed: () =>
        attempt({ type: 'fibking.bots.markAllBotsViewed' }, userContext('host')),
      // Non-mutating probe: the begin gate would commit right now.
      isCheckpointOpen: () =>
        decideFibCommand(state, { type: 'fibking.round.begin' }, userContext('host')).kind ===
        'commit',
    };
  },
});
