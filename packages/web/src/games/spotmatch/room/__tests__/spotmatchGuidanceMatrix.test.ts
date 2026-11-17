/**
 * Spotmatch guidance matrix: every (phase × viewer) cell declared in
 * spotmatchGuidanceMatrix.ts is held true against createSpotmatchRoomShellModel,
 * with states produced by the real engine (the game ends through the
 * engine's terminal seam).
 */
import {
  DEFAULT_SPOTMATCH_CONFIG,
  SPOTMATCH_PHASES,
  type SpotmatchCommand,
  spotmatchEngine,
  type SpotmatchPhaseKind,
  type SpotmatchState,
} from '@game-judge/game-engine/games/spotmatch/public';

import type { RoomSeatController } from '@/features/room/controllers/useRoomSeatController';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import {
  createBotTakeoverCapability,
  createRoomSetupCapabilities,
} from '@/features/room/model/RoomCapabilities';
import type { RoomViewerAudience } from '@/features/room/model/RoomViewer';
import { viewerFor } from '@/test-utils/roomViewer';
import { endSpotmatchTestGame } from '@/test-utils/spotmatchState';

import { SPOTMATCH_GUIDANCE_MATRIX } from '../spotmatchGuidanceMatrix';
import { createSpotmatchRoomShellModel } from '../spotmatchRoomAdapter';

type CommandContext = Parameters<typeof spotmatchEngine.decide>[2];

function drive(
  state: SpotmatchState,
  command: SpotmatchCommand,
  options: {
    userId?: string;
    nowMs?: number;
    system?: boolean;
    controlledSeat?: number | null;
  } = {},
): SpotmatchState {
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
          controlledSeat: options.controlledSeat ?? null,
          nowMs: options.nowMs ?? 1000,
          commandId: command.type,
          randomSeed: 'seed',
        };
  const decision = spotmatchEngine.decide(state, command, context);
  if (decision.kind === 'reject') throw new Error(`rejected: ${decision.reason}`);
  return decision.events.reduce(spotmatchEngine.evolve, state);
}

function lobbyState(): SpotmatchState {
  let state = spotmatchEngine.createInitialState(
    { ...DEFAULT_SPOTMATCH_CONFIG, numberOfPlayers: 4 },
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

function playingState(): SpotmatchState {
  const state = drive(lobbyState(), { type: 'spotmatch.game.begin' });
  if (state.phase.kind !== 'playing') throw new Error('expected playing');
  return state;
}

function stateFor(phase: SpotmatchPhaseKind): SpotmatchState {
  switch (phase) {
    case 'lobby':
      return lobbyState();
    case 'playing':
      return playingState();
    case 'ended': {
      const playing = playingState();
      const state = endSpotmatchTestGame(playing);
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
      requestTakeSeat: vi.fn(),
      requestMoveSeat: vi.fn(),
      leaveSeat: vi.fn(),
      kickSeat: vi.fn(),
      clearSeats: vi.fn(),
      fillBots: vi.fn(),
      configureGame: vi.fn(),
      shareRoom: vi.fn(),
    }),
    canViewProfiles: { isAllowed: true, execute: vi.fn() },
    canTakeOverBots: createBotTakeoverCapability(true, vi.fn()),
  };
}

const seatController: RoomSeatController = {
  pendingAction: null,
  isSubmitting: false,
  requestTakeSeat: vi.fn(),
  requestMoveSeat: vi.fn(),
  confirm: vi.fn(async () => undefined),
  cancel: vi.fn(),
};

function bottomMessage(state: SpotmatchState, audience: RoomViewerAudience): string | null {
  const viewer = viewerFor(audience);
  const model = createSpotmatchRoomShellModel({
    roomCode: '1234',
    viewer,
    capabilities: capabilities(),
    onBack: vi.fn(),
    onTitlePress: vi.fn(),
    onTitleLongPress: vi.fn(),
    user: { id: viewer.userId, avatarUrl: null },
    gachaStatus: null,
    onUserActionPress: vi.fn(),
    connection: {
      status: { kind: 'live' },
      pendingDurableCount: 0,
      onRetryNow: vi.fn(),
    },
    state,
    revision: 5,
    controlledSeat: null,
    seatsVisuallyDisabled: false,
    onSeatPress: vi.fn(),
    onBotSeatLongPress: null,
    seatController,
    profileSelection: null,
    gameDetails: null,
    onProfileClose: vi.fn(),
    onProfileLeaveSeat: vi.fn(),
    share: {
      isVisible: false,
      roomCode: '1234',
      roomUrl: 'https://example.test/1234',
      open: vi.fn(),
      close: vi.fn(),
      copyLink: vi.fn(async () => undefined),
      shareImage: vi.fn(async () => undefined),
    },
    isLobby: state.phase.kind === 'lobby',
    buildHostManagement: () => ({ task: null, sections: [] }),
    releaseBot: vi.fn(),
    review: state.phase.kind === 'ended' ? { isEnabled: true, onPress: vi.fn() } : null,
  });
  return model.bottomActions.message;
}

describe('SPOTMATCH_GUIDANCE_MATRIX', () => {
  it('covers exactly the engine phase list, each exempt cell with a reason', () => {
    expect(Object.keys(SPOTMATCH_GUIDANCE_MATRIX).sort()).toEqual([...SPOTMATCH_PHASES].sort());
    for (const row of Object.values(SPOTMATCH_GUIDANCE_MATRIX)) {
      for (const cell of Object.values(row)) {
        if (cell.kind === 'exempt') expect(cell.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it.each(SPOTMATCH_PHASES)('holds every viewer cell in phase %s', (phase) => {
    const state = stateFor(phase);
    for (const viewer of ['host', 'seated', 'spectator'] as const) {
      const cell = SPOTMATCH_GUIDANCE_MATRIX[phase][viewer];
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
