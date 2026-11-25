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
import { alertStore, dismissAlert } from '@/utils/alert';

import { SPOTMATCH_GUIDANCE_MATRIX } from '../spotmatchGuidanceMatrix';
import {
  createSpotmatchHostManagement,
  createSpotmatchRoomShellModel,
} from '../spotmatchRoomAdapter';

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
    isSubmitting: false,
    pendingActionKey: null,
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
    buildHostManagement: () => ({ task: null, actions: [] }),
    releaseBot: vi.fn(),
    review: state.phase.kind === 'ended' ? { isEnabled: true, onPress: vi.fn() } : null,
  });
  return model.playerActions.message;
}

describe('SPOTMATCH_GUIDANCE_MATRIX', () => {
  it('declares start pending even when the lobby is not full', () => {
    let state = lobbyState();
    state = drive(state, { type: 'room.seat.clear' });
    const host = createSpotmatchHostManagement({
      state,
      capabilities: capabilities(),
      isSubmitting: false,
      isScorePause: false,
      submit: vi.fn(async () => true),
      review: null,
    });
    expect(host.pendingActionKeys).toEqual(['start-game']);
    expect(host.actions[0]?.state.kind).toBe('blocked');
  });
  it.each(['playing', 'ended'] as const)(
    'offers one confirmed restart in %s without marking review as a task',
    async (phase) => {
      const state = stateFor(phase);
      const submit = vi.fn(async () => true);
      const host = createSpotmatchHostManagement({
        state,
        capabilities: capabilities(),
        isSubmitting: false,
        isScorePause: false,
        submit,
        review: phase === 'ended' ? { isEnabled: true, onPress: vi.fn() } : null,
      });
      expect(host.task).toBeNull();
      const actions = host.actions;
      expect(actions.filter((action) => action.key === 'restart')).toHaveLength(1);
      expect(
        actions.some((action) => ['next-round', 'return-lobby', 'abort-game'].includes(action.key)),
      ).toBe(false);
      const restart = actions.find((action) => action.key === 'restart');
      if (restart?.state.kind !== 'ready') throw new Error('Restart is not enabled');
      restart.state.onPress();
      expect(submit).not.toHaveBeenCalled();
      const confirmation = alertStore.getSnapshot();
      expect(confirmation).toMatchObject({
        title: '重新开始？',
        message:
          phase === 'ended'
            ? '保留座位和配置，清除本局结果并回到准备。已结算的战绩和奖励保留；之后可能无法查看复盘。'
            : '保留座位和配置，清除本局牌面与进度并回到准备。本局中止，不结算战绩与奖励。',
        buttons: [{ text: '取消' }, { text: '重新开始', style: 'destructive' }],
      });
      const handler = confirmation?.buttons[1]?.onPress;
      if (confirmation === null || handler === undefined)
        throw new Error('Missing restart confirmation');
      dismissAlert(confirmation.generation);
      await handler();
      expect(submit).toHaveBeenCalledWith(
        '重新开始',
        {
          type: 'spotmatch.game.restart',
          gameSequence: state.gameSequence,
          expectedPhase: phase,
        },
        { actionKey: 'restart' },
      );
    },
  );

  it('disables restart during score pause without marking it as pending', () => {
    const host = createSpotmatchHostManagement({
      state: playingState(),
      capabilities: capabilities(),
      isSubmitting: false,
      isScorePause: true,
      submit: vi.fn(async () => true),
      review: null,
    });
    const restart = host.actions.find(({ key }) => key === 'restart');

    expect(host.pendingActionKeys).toEqual([]);
    expect(restart).toMatchObject({ state: { kind: 'blocked', reason: null } });
  });

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
