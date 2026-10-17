/**
 * Pictionary guidance matrix: every (phase × viewer) cell declared in
 * pictionaryGuidanceMatrix.ts is held true against
 * createPictionaryRoomShellModel, with states produced by the real
 * engine. Relay steps are crossed by expiring timed phases at their
 * deadlines and resolving every settling task with an empty entry,
 * never by hand-assembling states.
 */
import {
  createPictionaryCommand,
  decidePictionaryCommand,
  DEFAULT_PICTIONARY_CONFIG,
  getPictionaryRelayStepCount,
  getPictionaryUserSeat,
  type PictionaryCommandInput,
  pictionaryEngine,
  type PictionaryPhase,
  type PictionaryState,
} from '@game-judge/game-engine/games/pictionary/public';

import { PICTIONARY_GUIDANCE_MATRIX } from '../pictionaryGuidanceMatrix';
import {
  createPictionaryRoomCapabilities,
  createPictionaryRoomShellModel,
  createPictionarySeatDataSource,
} from '../pictionaryRoomAdapter';

const PHASES: readonly PictionaryPhase[] = [
  'lobby',
  'answering',
  'settling',
  'transition',
  'gallery',
  'aborted',
  'ended',
];

interface Session {
  readonly state: PictionaryState;
  dispatch(command: PictionaryCommandInput, userId?: string): void;
  expire(): void;
}

function createSession(): Session {
  let now = 1000;
  let state = pictionaryEngine.createInitialState(
    { ...DEFAULT_PICTIONARY_CONFIG, numberOfPlayers: 4 },
    { roomCode: '2468', hostUserId: 'host', nowMs: now, commandId: 'create' },
  );
  const dispatch = (command: PictionaryCommandInput, userId = 'host') => {
    const seat = getPictionaryUserSeat(state, userId) ?? 0;
    const decision = decidePictionaryCommand(state, createPictionaryCommand(state, command, seat), {
      actor: { kind: 'user', userId },
      controlledSeat: null,
      nowMs: now,
      commandId: `command-${now}`,
      randomSeed: 'matrix',
    });
    if (decision.kind !== 'commit') throw new Error(decision.reason);
    for (const event of decision.events) state = pictionaryEngine.evolve(state, event);
    state = pictionaryEngine.normalize(state);
  };
  return {
    get state() {
      return state;
    },
    dispatch,
    expire() {
      if (state.deadlineAt === null) throw new Error(`phase ${state.phase} has no deadline`);
      now = state.deadlineAt;
      dispatch({ type: 'pictionary.phase.expire', phaseRevision: state.phaseRevision });
    },
  };
}

const seatUser = (seat: number) => (seat === 0 ? 'host' : `u${seat}`);

function startedSession(): Session {
  const session = createSession();
  for (let seat = 0; seat < 4; seat += 1) {
    session.dispatch(
      { type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } },
      seatUser(seat),
    );
  }
  session.dispatch({ type: 'pictionary.round.start' });
  if (session.state.phase !== 'answering') throw new Error('expected answering');
  return session;
}

/** Resolves every seat's task of the settling step with an empty entry. */
function settleStep(session: Session) {
  for (let seat = 0; seat < 4; seat += 1) {
    session.dispatch({ type: 'pictionary.task.empty.submit' }, seatUser(seat));
  }
  if (session.state.phase !== 'transition') throw new Error('expected transition');
}

/** Crosses one relay step: expire answering, settle all tasks, expire transition. */
function crossStep(session: Session) {
  session.expire();
  if (session.state.phase !== 'settling') throw new Error('expected settling');
  settleStep(session);
  session.expire();
}

function stateFor(phase: PictionaryPhase): PictionaryState {
  if (phase === 'lobby') return createSession().state;
  const session = startedSession();
  switch (phase) {
    case 'answering':
      return session.state;
    case 'settling':
      session.expire();
      if (session.state.phase !== 'settling') throw new Error('expected settling');
      return session.state;
    case 'transition':
      session.expire();
      settleStep(session);
      return session.state;
    case 'gallery': {
      const steps = getPictionaryRelayStepCount(4);
      for (let step = 0; step < steps; step += 1) crossStep(session);
      if (session.state.phase !== 'gallery') throw new Error('expected gallery');
      return session.state;
    }
    case 'ended': {
      const steps = getPictionaryRelayStepCount(4);
      for (let step = 0; step < steps; step += 1) crossStep(session);
      if (session.state.phase !== 'gallery') throw new Error('expected gallery');
      session.dispatch({ type: 'pictionary.gallery.finish' });
      if (phaseOf(session) !== 'ended') throw new Error('expected ended');
      return session.state;
    }
    case 'aborted':
      session.dispatch({ type: 'pictionary.round.abort' });
      if (session.state.phase !== 'aborted') throw new Error('expected aborted');
      return session.state;
    default:
      throw new Error(`unhandled phase ${phase}`);
  }
}

/** Reads the phase through a call so TS narrowing never goes stale across dispatches. */
const phaseOf = (session: Session): PictionaryPhase => session.state.phase;

type Viewer = 'host' | 'seated' | 'spectator';

function bottomMessage(state: PictionaryState, viewer: Viewer): string | null {
  const isHost = viewer === 'host';
  const mySeat = viewer === 'host' ? 0 : viewer === 'seated' ? 1 : null;
  const capabilities = createPictionaryRoomCapabilities({
    state,
    isHost,
    mySeat,
    requestTakeSeat: jest.fn(),
    requestMoveSeat: jest.fn(),
    leaveSeat: jest.fn(),
    kickSeat: jest.fn(),
    clearSeats: jest.fn(),
    fillBots: jest.fn(),
    configureGame: jest.fn(),
    openProfile: jest.fn(),
    takeOverBot: jest.fn(),
    shareRoom: jest.fn(),
  });
  const model = createPictionaryRoomShellModel({
    roomCode: '2468',
    capabilities,
    onBack: jest.fn(),
    onTitlePress: jest.fn(),
    onTitleLongPress: jest.fn(),
    user: { id: isHost ? 'host' : 'u1', avatarUrl: null },
    gachaStatus: null,
    onUserActionPress: jest.fn(),
    connection: { status: 'live', pendingCommandCount: 0, onManualReconnect: jest.fn() },
    state,
    isHost,
    mySeat,
    seatSource: createPictionarySeatDataSource({
      state,
      revision: 1,
      myUserId: isHost ? 'host' : 'u1',
      controlledSeat: null,
    }),
    seatsVisuallyDisabled: false,
    onSeatPress: jest.fn(),
    onBotSeatLongPress: null,
    seatConfirmation: null,
    profile: null,
    share: {
      isVisible: false,
      roomCode: '2468',
      roomUrl: 'https://example.test/2468',
      open: jest.fn(),
      close: jest.fn(),
      copyLink: jest.fn(async () => undefined),
      shareImage: jest.fn(async () => undefined),
    },
    hostManagement: null,
    controlledSeat: null,
  });
  return model.bottomActions.message;
}

describe('PICTIONARY_GUIDANCE_MATRIX', () => {
  it('covers exactly the PictionaryPhase union, each exempt cell with a reason', () => {
    expect(Object.keys(PICTIONARY_GUIDANCE_MATRIX).sort()).toEqual([...PHASES].sort());
    for (const row of Object.values(PICTIONARY_GUIDANCE_MATRIX)) {
      for (const cell of Object.values(row)) {
        if (cell.kind === 'exempt') expect(cell.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it.each(PHASES)('holds every viewer cell in phase %s', (phase) => {
    const state = stateFor(phase);
    for (const viewer of ['host', 'seated', 'spectator'] as const) {
      const cell = PICTIONARY_GUIDANCE_MATRIX[phase][viewer];
      const message = bottomMessage(state, viewer);
      if (cell.kind === 'message') {
        if (typeof message !== 'string' || message === '') {
          throw new Error(
            `${phase} x ${viewer}: declared a message cell, got ${JSON.stringify(message)}`,
          );
        }
      } else if (message !== null) {
        throw new Error(
          `${phase} x ${viewer}: declared exempt (${cell.reason}), got ${JSON.stringify(message)}`,
        );
      }
    }
  });
});
