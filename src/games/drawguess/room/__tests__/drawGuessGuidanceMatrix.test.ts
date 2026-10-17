/**
 * DrawGuess guidance matrix: every (phase × viewer) cell declared in
 * drawGuessGuidanceMatrix.ts is held true against
 * createDrawGuessRoomShellModel, with states produced by the real
 * engine. Turns are crossed by expiring each timed phase at its
 * deadline (wordSelect expiry auto-assigns a word, as the engine
 * contract allows).
 */
import {
  DEFAULT_DRAWGUESS_CONFIG,
  type DrawGuessCommand,
  drawGuessEngine,
  type DrawGuessPhase,
  type DrawGuessState,
  type DrawGuessWordChoice,
} from '@game-judge/game-engine/games/drawguess/public';

import type { RoomSeatController } from '@/features/room/controllers/useRoomSeatController';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import {
  createBotTakeoverCapability,
  createRoomSetupCapabilities,
} from '@/features/room/model/RoomCapabilities';

import { DRAWGUESS_GUIDANCE_MATRIX } from '../drawGuessGuidanceMatrix';
import { createDrawGuessRoomShellModel } from '../drawGuessRoomAdapter';

type CommandContext = Parameters<typeof drawGuessEngine.decide>[2];

// The engine keeps this list internal to its state module; the literal
// is type-checked against the phase kind union so a new phase breaks here.
const DRAWGUESS_PHASES: readonly DrawGuessPhase['kind'][] = [
  'lobby',
  'wordSelect',
  'drawing',
  'roundEnd',
  'ended',
];

const CHOICES: DrawGuessWordChoice[] = [
  { word: '大熊猫', pinyinInitials: 'd x m' },
  { word: '火锅', pinyinInitials: 'h g' },
  { word: '风筝', pinyinInitials: 'f z' },
];

const seatUser = (seat: number) => (seat === 0 ? 'host' : `u${seat}`);

interface Session {
  readonly state: DrawGuessState;
  send(command: DrawGuessCommand, userId?: string): void;
  sendSystem(command: DrawGuessCommand): void;
  expire(): void;
}

function createSession(): Session {
  let commandNumber = 0;
  let now = 1000;
  let state: DrawGuessState = drawGuessEngine.createInitialState(
    { ...DEFAULT_DRAWGUESS_CONFIG, numberOfPlayers: 4 },
    { roomCode: '1234', hostUserId: 'host', nowMs: now, commandId: 'create' },
  );
  const apply = (command: DrawGuessCommand, context: CommandContext) => {
    const decision = drawGuessEngine.decide(state, command, context);
    if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
    state = decision.events.reduce(drawGuessEngine.evolve, state);
  };
  const send = (command: DrawGuessCommand, userId = 'host') =>
    apply(command, {
      actor: { kind: 'user', userId },
      controlledSeat: null,
      nowMs: now,
      commandId: `command:${commandNumber++}`,
      randomSeed: `seed:${commandNumber}`,
    });
  return {
    get state() {
      return state;
    },
    send,
    sendSystem(command) {
      apply(command, {
        actor: { kind: 'system', effectId: 'effect:1' },
        controlledSeat: null,
        nowMs: now,
        commandId: `command:${commandNumber++}`,
        randomSeed: `seed:${commandNumber}`,
      });
    },
    expire() {
      const phase = state.phase;
      if (
        (phase.kind === 'wordSelect' || phase.kind === 'drawing' || phase.kind === 'roundEnd') &&
        phase.deadlineAt !== null
      ) {
        now = phase.deadlineAt;
      }
      send({
        type: 'drawguess.phase.expire',
        phaseRevision: state.phaseRevision,
        turnIndex: state.turnIndex,
      });
    },
  };
}

function lobbySession(): Session {
  const session = createSession();
  for (let seat = 0; seat < 4; seat += 1) {
    session.send(
      { type: 'room.seat.take', seat, profile: { displayName: `P${seat}` } },
      seatUser(seat),
    );
  }
  return session;
}

function wordSelectSession(): Session {
  const session = lobbySession();
  session.send({ type: 'drawguess.round.start' });
  session.sendSystem({ type: 'drawguess.words.dealt', turnIndex: 0, choices: CHOICES });
  if (session.state.phase.kind !== 'wordSelect') throw new Error('expected wordSelect');
  return session;
}

function stateFor(phase: DrawGuessPhase['kind']): DrawGuessState {
  if (phase === 'lobby') return lobbySession().state;
  const session = wordSelectSession();
  switch (phase) {
    case 'wordSelect':
      return session.state;
    case 'drawing': {
      const current = session.state.phase;
      if (current.kind !== 'wordSelect') throw new Error('expected wordSelect');
      session.send(
        {
          type: 'drawguess.word.choose',
          word: CHOICES[0]!.word,
          phaseRevision: session.state.phaseRevision,
          turnIndex: session.state.turnIndex,
        },
        seatUser(current.drawerSeat),
      );
      if (session.state.phase.kind !== 'drawing') throw new Error('expected drawing');
      return session.state;
    }
    case 'roundEnd': {
      const current = session.state.phase;
      if (current.kind !== 'wordSelect') throw new Error('expected wordSelect');
      session.send(
        {
          type: 'drawguess.word.choose',
          word: CHOICES[0]!.word,
          phaseRevision: session.state.phaseRevision,
          turnIndex: session.state.turnIndex,
        },
        seatUser(current.drawerSeat),
      );
      session.expire();
      if (session.state.phase.kind !== 'roundEnd') throw new Error('expected roundEnd');
      return session.state;
    }
    case 'ended': {
      // Cross every remaining turn by expiry until the game ends.
      for (let guard = 0; guard < 40 && session.state.phase.kind !== 'ended'; guard += 1) {
        const current = session.state.phase;
        if (current.kind === 'wordSelect' && current.choices.length === 0) {
          session.sendSystem({
            type: 'drawguess.words.dealt',
            turnIndex: session.state.turnIndex,
            choices: CHOICES,
          });
        }
        session.expire();
      }
      if (session.state.phase.kind !== 'ended') throw new Error('expected ended');
      return session.state;
    }
    case 'lobby':
      throw new Error('unreachable');
  }
}

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

function bottomMessage(state: DrawGuessState, viewer: Viewer): string | null {
  const isHost = viewer === 'host';
  const mySeat = viewer === 'host' ? 0 : viewer === 'seated' ? 1 : null;
  const model = createDrawGuessRoomShellModel({
    roomCode: '1234',
    capabilities: capabilities(),
    onBack: jest.fn(),
    onTitlePress: jest.fn(),
    onTitleLongPress: jest.fn(),
    user: { id: isHost ? 'host' : 'u1', avatarUrl: null },
    gachaStatus: null,
    onUserActionPress: jest.fn(),
    connection: { status: 'live', pendingCommandCount: 0, onManualReconnect: jest.fn() },
    state,
    revision: 5,
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
    isLobby: state.phase.kind === 'lobby',
    isHost,
    mySeat,
    hostManagement: null,
    releaseBot: jest.fn(),
  });
  return model.bottomActions.message;
}

describe('DRAWGUESS_GUIDANCE_MATRIX', () => {
  it('covers exactly the engine phase list, each exempt cell with a reason', () => {
    expect(Object.keys(DRAWGUESS_GUIDANCE_MATRIX).sort()).toEqual([...DRAWGUESS_PHASES].sort());
    for (const row of Object.values(DRAWGUESS_GUIDANCE_MATRIX)) {
      for (const cell of Object.values(row)) {
        if (cell.kind === 'exempt') expect(cell.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it.each(DRAWGUESS_PHASES)('holds every viewer cell in phase %s', (phase) => {
    const state = stateFor(phase);
    for (const viewer of ['host', 'seated', 'spectator'] as const) {
      const cell = DRAWGUESS_GUIDANCE_MATRIX[phase][viewer];
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
