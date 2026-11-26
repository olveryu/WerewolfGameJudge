/**
 * Decrypto guidance matrix: every (phase × viewer) cell declared in
 * decryptoGuidanceMatrix.ts is held true against createDecryptoRoomShellModel,
 * with states produced by playing the real engine through each phase.
 */
import {
  DECRYPTO_PHASES,
  type DecryptoPhaseKind,
  type DecryptoState,
  getDecryptoOccupiedSeatCount,
} from '@game-judge/game-engine/games/decrypto/public';

import { confirmAction } from '@/features/room/confirm';
import type { RoomSeatController } from '@/features/room/controllers/useRoomSeatController';
import { HOST_ACTION_KEYS } from '@/features/room/model/hostManagementActions';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import {
  createBotTakeoverCapability,
  createRoomSetupCapabilities,
} from '@/features/room/model/RoomCapabilities';
import type { RoomViewerAudience } from '@/features/room/model/RoomViewer';
import { buildDecryptoStateForPhase } from '@/test-utils/decryptoState';
import { viewerFor } from '@/test-utils/roomViewer';

import { DECRYPTO_GUIDANCE_MATRIX } from '../decryptoGuidanceMatrix';
import { createDecryptoHostManagement, createDecryptoRoomShellModel } from '../decryptoRoomAdapter';

vi.mock('@/features/room/confirm', () => ({ confirmAction: vi.fn(), confirmView: vi.fn() }));
vi.mock('@/utils/alertPresets', () => ({ showErrorAlert: vi.fn(), showDismissAlert: vi.fn() }));

function stateFor(phase: DecryptoPhaseKind): DecryptoState {
  return buildDecryptoStateForPhase(phase);
}

function capabilities(isSetup = true, isRoomFull = true): RoomCapabilities {
  return {
    ...createRoomSetupCapabilities({
      isSetup,
      isHost: true,
      mySeat: 0,
      supportsBots: true,
      hasOccupiedSeats: true,
      isRoomFull,
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

describe('Decrypto host controls', () => {
  const submit = vi.fn(async () => true);
  function hostModel(
    state: DecryptoState,
    isSubmitting = false,
    roomCapabilities = capabilities(
      state.phase.kind === 'lobby',
      getDecryptoOccupiedSeatCount(state) === state.config.numberOfPlayers,
    ),
  ) {
    return createDecryptoHostManagement({
      state,
      submit,
      capabilities: roomCapabilities,
      isSubmitting,
      review:
        state.phase.kind === 'ended'
          ? {
              isEnabled: true,
              onPress: vi.fn(),
            }
          : null,
    });
  }
  it.each(DECRYPTO_PHASES)('exposes only the expected host actions in %s', (phase) => {
    const actions = hostModel(stateFor(phase)).actions;
    const actualKeys = actions.map((action) => action.key).sort();
    const expectedKeys: string[] = [];
    if (phase === 'lobby') {
      expectedKeys.push(
        HOST_ACTION_KEYS.startGame,
        HOST_ACTION_KEYS.configureGame,
        HOST_ACTION_KEYS.clearSeats,
      );
    }
    if (phase === 'playing') expectedKeys.push(HOST_ACTION_KEYS.restart);
    if (phase === 'ended') {
      expectedKeys.push(HOST_ACTION_KEYS.review, HOST_ACTION_KEYS.restart);
    }
    expect(actualKeys).toEqual(expectedKeys.sort());
  });

  it('marks the lobby host task as pending even when seats are missing', () => {
    expect(hostModel(stateFor('lobby')).pendingActionKeys).toEqual([HOST_ACTION_KEYS.startGame]);
  });

  it('offers fill-bots only for an open lobby and runs each setup action through its capability', () => {
    const roomCapabilities = capabilities(true, false);
    const actions = hostModel(stateFor('lobby'), false, roomCapabilities).actions;
    for (const [actionKey, capability] of [
      [HOST_ACTION_KEYS.configureGame, roomCapabilities.canConfigureGame],
      [HOST_ACTION_KEYS.fillBots, roomCapabilities.canFillBots],
      [HOST_ACTION_KEYS.clearSeats, roomCapabilities.canClearSeats],
    ] as const) {
      const action = actions.find((entry) => entry.key === actionKey);
      if (action?.state.kind !== 'ready' || !capability.isAllowed)
        throw new Error(`Missing enabled setup action: ${actionKey}`);
      action.state.onPress();
      expect(capability.execute).toHaveBeenCalledOnce();
    }
    expect(actions.map((action) => action.key)).toContain(HOST_ACTION_KEYS.fillBots);
  });

  it('dispatches game start only after host confirmation', async () => {
    submit.mockClear();
    const action = hostModel(stateFor('lobby')).actions.find(
      (entry) => entry.key === HOST_ACTION_KEYS.startGame,
    );
    if (action?.state.kind !== 'ready') throw new Error('Missing enabled game start');
    action.state.onPress();
    expect(submit).not.toHaveBeenCalled();
    const confirm = vi.mocked(confirmAction).mock.calls.at(-1)?.[0].onConfirm;
    if (confirm === undefined) throw new Error('Missing game start confirmation');
    await confirm();
    expect(submit).toHaveBeenCalledWith(
      '开始游戏',
      { type: 'decrypto.game.begin' },
      { actionKey: HOST_ACTION_KEYS.startGame },
    );
  });

  it('confirms terminal restart before dispatch', async () => {
    submit.mockClear();
    const state = stateFor('ended');
    const action = hostModel(state).actions.find((entry) => entry.key === HOST_ACTION_KEYS.restart);
    if (action?.state.kind !== 'ready') throw new Error('Missing enabled terminal restart');
    action.state.onPress();
    expect(submit).not.toHaveBeenCalled();
    const confirm = vi.mocked(confirmAction).mock.calls.at(-1)?.[0].onConfirm;
    if (confirm === undefined) throw new Error('Missing restart confirmation');
    await confirm();
    expect(submit).toHaveBeenCalledWith(
      '重新开始',
      {
        type: 'decrypto.game.restart',
        gameSequence: state.gameSequence,
        wasEnded: true,
      },
      { actionKey: HOST_ACTION_KEYS.restart },
    );
  });

  it('disables the lobby transition while a host command is submitting', () => {
    const key = HOST_ACTION_KEYS.startGame;
    const action = hostModel(stateFor('lobby'), true).actions.find((entry) => entry.key === key);
    expect(action?.state.kind).toBe('busy');
  });

  it('submits in-game restart only after confirmation', async () => {
    submit.mockClear();
    const state = stateFor('playing');
    const action = hostModel(state).actions.find((entry) => entry.key === HOST_ACTION_KEYS.restart);
    if (action?.state.kind !== 'ready') throw new Error('Missing restart action');
    action.state.onPress();
    expect(submit).not.toHaveBeenCalled();
    const confirm = vi.mocked(confirmAction).mock.calls.at(-1)?.[0].onConfirm;
    if (confirm === undefined) throw new Error('Missing restart confirmation');
    await confirm();
    expect(submit).toHaveBeenCalledWith(
      '重新开始',
      {
        type: 'decrypto.game.restart',
        gameSequence: state.gameSequence,
        wasEnded: false,
      },
      { actionKey: HOST_ACTION_KEYS.restart },
    );
  });
});

const seatController: RoomSeatController = {
  pendingAction: null,
  isSubmitting: false,
  requestTakeSeat: vi.fn(),
  requestMoveSeat: vi.fn(),
  confirm: vi.fn(async () => undefined),
  cancel: vi.fn(),
};

function shellModel(
  state: DecryptoState,
  audience: RoomViewerAudience,
  buildHostManagement = () => ({ task: null, actions: [] }),
  options: {
    controlledSeat?: number | null;
    isSubmitting?: boolean;
  } = {},
) {
  const viewer = viewerFor(audience);
  return createDecryptoRoomShellModel({
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
    controlledSeat: options.controlledSeat ?? null,
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
    isSubmitting: options.isSubmitting ?? false,
    pendingActionKey: null,
    buildHostManagement,
    releaseBot: vi.fn(),
    review: state.phase.kind === 'ended' ? { isEnabled: true, onPress: vi.fn() } : null,
  });
}

function bottomMessage(
  state: DecryptoState,
  audience: RoomViewerAudience,
  buildHostManagement = () => ({ task: null, actions: [] }),
): string | null {
  return shellModel(state, audience, buildHostManagement).playerActions.message;
}

describe('DECRYPTO_GUIDANCE_MATRIX', () => {
  it('builds host controls only for the host viewer', () => {
    const buildHostManagement = vi.fn(() => ({ task: null, actions: [] }));
    bottomMessage(stateFor('lobby'), 'seated', buildHostManagement);
    bottomMessage(stateFor('lobby'), 'spectator', buildHostManagement);
    expect(buildHostManagement).not.toHaveBeenCalled();

    bottomMessage(stateFor('lobby'), 'host', buildHostManagement);
    expect(buildHostManagement).toHaveBeenCalledOnce();
  });

  it('covers exactly the engine phase list, each exempt cell with a reason', () => {
    expect(Object.keys(DECRYPTO_GUIDANCE_MATRIX).sort()).toEqual([...DECRYPTO_PHASES].sort());
    for (const row of Object.values(DECRYPTO_GUIDANCE_MATRIX)) {
      for (const cell of Object.values(row)) {
        if (cell.kind === 'exempt') expect(cell.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it.each(DECRYPTO_PHASES)('holds every viewer cell in phase %s', (phase) => {
    const state = stateFor(phase);
    for (const viewer of ['host', 'seated', 'spectator'] as const) {
      const cell = DECRYPTO_GUIDANCE_MATRIX[phase][viewer];
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
