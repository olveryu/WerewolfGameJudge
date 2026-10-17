/**
 * Demo guidance matrix: every (phase × viewer) cell declared in
 * demoGuidanceMatrix.ts is held true against createDemoRoomShellModel,
 * with states produced by the real engine (the playing phase settles
 * through its deadline system command, as in the engine full-chain
 * test).
 */
import {
  DEFAULT_DEMO_CONFIG,
  DEMO_PHASES,
  DEMO_STAGE_DURATION_MS,
  type DemoCommand,
  demoEngine,
  type DemoPhaseKind,
  type DemoState,
} from '@game-judge/game-engine/games/demo/public';

import type { RoomSeatController } from '@/features/room/controllers/useRoomSeatController';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import {
  createBotTakeoverCapability,
  createRoomSetupCapabilities,
} from '@/features/room/model/RoomCapabilities';

import { DEMO_GUIDANCE_MATRIX } from '../demoGuidanceMatrix';
import { createDemoRoomShellModel } from '../demoRoomAdapter';

type CommandContext = Parameters<typeof demoEngine.decide>[2];

function drive(
  state: DemoState,
  command: DemoCommand,
  options: { userId?: string; nowMs?: number; system?: boolean } = {},
): DemoState {
  const context: CommandContext =
    options.system === true
      ? {
          actor: { kind: 'system', effectId: 'settle-effect' },
          controlledSeat: null,
          nowMs: options.nowMs ?? 1000,
          commandId: command.type,
          randomSeed: 'seed',
        }
      : {
          actor: { kind: 'user', userId: options.userId ?? 'host' },
          controlledSeat: null,
          nowMs: options.nowMs ?? 1000,
          commandId: command.type,
          randomSeed: 'seed',
        };
  const decision = demoEngine.decide(state, command, context);
  if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
  return decision.events.reduce(demoEngine.evolve, state);
}

function lobbyState(): DemoState {
  let state = demoEngine.createInitialState(
    { ...DEFAULT_DEMO_CONFIG, numberOfPlayers: 4 },
    { roomCode: '1234', hostUserId: 'host', nowMs: 1000, commandId: 'create' },
  );
  state = drive(state, { type: 'room.seat.take', seat: 0, profile: { displayName: '房主' } });
  state = drive(
    state,
    { type: 'room.seat.take', seat: 1, profile: { displayName: 'P1' } },
    {
      userId: 'u1',
    },
  );
  state = drive(state, { type: 'room.seat.fillBots' });
  return state;
}

function viewingState(): DemoState {
  const state = drive(lobbyState(), { type: 'demo.game.start' });
  if (state.phase.kind !== 'viewing') throw new Error('expected viewing');
  return state;
}

function playingState(): DemoState {
  let state = viewingState();
  state = drive(state, { type: 'demo.role.viewed' });
  state = drive(state, { type: 'demo.role.viewed' }, { userId: 'u1' });
  state = drive(state, { type: 'demo.bots.markAllBotsViewed' });
  state = drive(state, { type: 'demo.game.begin' });
  if (state.phase.kind !== 'playing') throw new Error('expected playing');
  return state;
}

function stateFor(phase: DemoPhaseKind): DemoState {
  switch (phase) {
    case 'lobby':
      return lobbyState();
    case 'viewing':
      return viewingState();
    case 'playing':
      return playingState();
    case 'ended': {
      const state = drive(
        playingState(),
        { type: 'demo.phase.settleExpired' },
        { system: true, nowMs: 1000 + DEMO_STAGE_DURATION_MS },
      );
      if (state.phase.kind !== 'ended') throw new Error('expected ended');
      return state;
    }
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

function bottomMessage(state: DemoState, viewer: Viewer): string | null {
  const isHost = viewer === 'host';
  const mySeat = viewer === 'host' ? 0 : viewer === 'seated' ? 1 : null;
  const model = createDemoRoomShellModel({
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
    hostManagement: { sections: [] },
    releaseBot: jest.fn(),
  });
  return model.bottomActions.message;
}

describe('DEMO_GUIDANCE_MATRIX', () => {
  it('covers exactly the engine phase list, each exempt cell with a reason', () => {
    expect(Object.keys(DEMO_GUIDANCE_MATRIX).sort()).toEqual([...DEMO_PHASES].sort());
    for (const row of Object.values(DEMO_GUIDANCE_MATRIX)) {
      for (const cell of Object.values(row)) {
        if (cell.kind === 'exempt') expect(cell.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it.each(DEMO_PHASES)('holds every viewer cell in phase %s', (phase) => {
    const state = stateFor(phase);
    for (const viewer of ['host', 'seated', 'spectator'] as const) {
      const cell = DEMO_GUIDANCE_MATRIX[phase][viewer];
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
