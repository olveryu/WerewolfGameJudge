/**
 * StoryRelay guidance matrix: every (phase × viewer) cell declared in
 * storyRelayGuidanceMatrix.ts is held true against
 * createStoryRelayRoomShellModel, with states produced by the real
 * engine (host finishes each writing step, every seat resolves its
 * settling task with an empty entry, timed phases expire at their
 * deadlines).
 */
import {
  DEFAULT_STORY_RELAY_CONFIG,
  getStoryRelayTaskForSeat,
  type StoryRelayCommand,
  storyRelayEngine,
  type StoryRelayState,
} from '@game-judge/game-engine/games/storyrelay/public';

import type { RoomSeatController } from '@/features/room/controllers/useRoomSeatController';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import {
  createBotTakeoverCapability,
  createRoomSetupCapabilities,
} from '@/features/room/model/RoomCapabilities';

import { STORY_RELAY_GUIDANCE_MATRIX } from '../storyRelayGuidanceMatrix';
import { createStoryRelayRoomShellModel } from '../storyRelayRoomAdapter';

type Phase = StoryRelayState['phase'];
const PHASES: readonly Phase[] = [
  'lobby',
  'answering',
  'settling',
  'transition',
  'gallery',
  'ended',
  'aborted',
];

type CommandContext = Parameters<typeof storyRelayEngine.decide>[2];

interface Session {
  readonly state: StoryRelayState;
  send(command: StoryRelayCommand, userId?: string, controlledSeat?: number | null): void;
  expire(): void;
}

function createSession(): Session {
  let commandNumber = 0;
  let now = 1000;
  let state: StoryRelayState = storyRelayEngine.createInitialState(
    { ...DEFAULT_STORY_RELAY_CONFIG, numberOfPlayers: 4 },
    { roomCode: '1234', hostUserId: 'host', nowMs: now, commandId: 'create' },
  );
  const send = (
    command: StoryRelayCommand,
    userId = 'host',
    controlledSeat: number | null = null,
  ) => {
    const context: CommandContext = {
      actor: { kind: 'user', userId },
      controlledSeat,
      nowMs: now,
      commandId: `command:${commandNumber++}`,
      randomSeed: `seed:${commandNumber}`,
    };
    const decision = storyRelayEngine.decide(state, command, context);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
    state = decision.events.reduce(storyRelayEngine.evolve, state);
  };
  return {
    get state() {
      return state;
    },
    send,
    expire() {
      if (state.deadlineAt === null) throw new Error(`phase ${state.phase} has no deadline`);
      now = state.deadlineAt;
      send({ type: 'storyrelay.phase.expire', phaseRevision: state.phaseRevision });
    },
  };
}

function startedSession(): Session {
  const session = createSession();
  session.send({ type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
  // Bot seats: the host resolves their settling tasks through the
  // takeover seat (controlledSeat is only legal for bot seats), the
  // same driving path as the engine relay-chain contract test.
  session.send({ type: 'room.seat.fillBots' });
  session.send({ type: 'storyrelay.round.start' });
  if (session.state.phase !== 'answering') throw new Error('expected answering');
  return session;
}

/** Resolves every seat's settling task with an empty entry, landing in transition. */
function settleStep(session: Session) {
  for (let seat = 0; seat < 4; seat += 1) {
    const task = getStoryRelayTaskForSeat(session.state, seat);
    if (task === null) throw new Error(`no task for seat ${seat}`);
    session.send(
      {
        type: 'storyrelay.task.empty.submit',
        roundId: task.roundId,
        stepIndex: task.stepIndex,
        chainId: task.chainId,
      },
      'host',
      seat === 0 ? null : seat,
    );
  }
  if (session.state.phase !== 'transition') throw new Error('expected transition');
}

function finishWriting(session: Session) {
  session.send({ type: 'storyrelay.phase.finish', phaseRevision: session.state.phaseRevision });
  if (session.state.phase !== 'settling') throw new Error('expected settling');
}

function crossStep(session: Session) {
  finishWriting(session);
  settleStep(session);
  session.expire();
}

function stateFor(phase: Phase): StoryRelayState {
  if (phase === 'lobby') return createSession().state;
  const session = startedSession();
  switch (phase) {
    case 'answering':
      return session.state;
    case 'settling':
      finishWriting(session);
      return session.state;
    case 'transition':
      finishWriting(session);
      settleStep(session);
      return session.state;
    case 'gallery':
      for (let step = 0; step < 4; step += 1) crossStep(session);
      if (session.state.phase !== 'gallery') throw new Error('expected gallery');
      return session.state;
    case 'ended':
      for (let step = 0; step < 4; step += 1) crossStep(session);
      if (session.state.phase !== 'gallery') throw new Error('expected gallery');
      session.send({
        type: 'storyrelay.gallery.finish',
        phaseRevision: session.state.phaseRevision,
      });
      if (phaseOf(session) !== 'ended') throw new Error('expected ended');
      return session.state;
    case 'aborted':
      session.send({ type: 'storyrelay.round.abort', phaseRevision: session.state.phaseRevision });
      if (session.state.phase !== 'aborted') throw new Error('expected aborted');
      return session.state;
    default:
      throw new Error(`unhandled phase ${phase}`);
  }
}

/** Reads the phase through a call so TS narrowing never goes stale across sends. */
const phaseOf = (session: Session): Phase => session.state.phase;

function capabilities(): RoomCapabilities {
  return {
    ...createRoomSetupCapabilities({
      isSetup: true,
      isHost: true,
      mySeat: 0,
      supportsBots: true,
      hasOccupiedSeats: true,
      isRoomFull: true,
      requestTakeSeat: jest.fn(),
      requestMoveSeat: jest.fn(),
      leaveSeat: jest.fn(),
      kickSeat: jest.fn(),
      clearSeats: jest.fn(),
      fillBots: jest.fn(),
      configureGame: jest.fn(),
      shareRoom: jest.fn(),
    }),
    canViewProfiles: { isAllowed: true, execute: jest.fn() },
    canTakeOverBots: createBotTakeoverCapability(true, jest.fn()),
  };
}

const seatController: RoomSeatController = {
  pendingAction: null,
  isSubmitting: false,
  requestTakeSeat: jest.fn(),
  requestMoveSeat: jest.fn(),
  confirm: jest.fn(async () => undefined),
  cancel: jest.fn(),
};

type Viewer = 'host' | 'seated' | 'spectator';

function bottomMessage(state: StoryRelayState, viewer: Viewer): string | null {
  const isHost = viewer === 'host';
  const mySeat = viewer === 'host' ? 0 : viewer === 'seated' ? 1 : null;
  const model = createStoryRelayRoomShellModel({
    roomCode: '1234',
    capabilities: capabilities(),
    onBack: jest.fn(),
    onTitlePress: jest.fn(),
    onTitleLongPress: jest.fn(),
    user: { id: isHost ? 'host' : 'u1', avatarUrl: null },
    gachaStatus: undefined,
    onUserActionPress: jest.fn(),
    connection: { status: 'live', pendingCommandCount: 0, onManualReconnect: jest.fn() },
    state,
    revision: 2,
    userId: isHost ? 'host' : 'u1',
    controlledSeat: null,
    seatsVisuallyDisabled: false,
    onSeatPress: jest.fn(),
    onBotSeatLongPress: null,
    seatController,
    profileSelection: null,
    onProfileClose: jest.fn(),
    onProfileLeaveSeat: jest.fn(),
    share: {
      isVisible: false,
      roomCode: '1234',
      roomUrl: 'https://example.test/1234',
      open: jest.fn(),
      close: jest.fn(),
      copyLink: jest.fn(async () => undefined),
      shareImage: jest.fn(async () => undefined),
    },
    isLobby: state.phase === 'lobby',
    isHost,
    mySeat,
    hostManagement: { sections: [] },
    releaseBot: jest.fn(),
  });
  return model.bottomActions.message;
}

describe('STORY_RELAY_GUIDANCE_MATRIX', () => {
  it('covers exactly the phase union, each exempt cell with a reason', () => {
    expect(Object.keys(STORY_RELAY_GUIDANCE_MATRIX).sort()).toEqual([...PHASES].sort());
    for (const row of Object.values(STORY_RELAY_GUIDANCE_MATRIX)) {
      for (const cell of Object.values(row)) {
        if (cell.kind === 'exempt') expect(cell.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it.each(PHASES)('holds every viewer cell in phase %s', (phase) => {
    const state = stateFor(phase);
    for (const viewer of ['host', 'seated', 'spectator'] as const) {
      const cell = STORY_RELAY_GUIDANCE_MATRIX[phase][viewer];
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
