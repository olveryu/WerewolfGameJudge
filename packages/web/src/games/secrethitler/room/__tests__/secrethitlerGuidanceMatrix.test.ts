/**
 * Secrethitler guidance matrix: every (phase × viewer) cell declared in
 * secrethitlerGuidanceMatrix.ts is held true against createSecrethitlerRoomShellModel,
 * with states produced by the real engine (the game ends through the
 * engine's terminal seam).
 */
import {
  SECRETHITLER_PHASES,
  type SecrethitlerState,
} from '@game-judge/game-engine/games/secrethitler/public';

import type { RoomSeatController } from '@/features/room/controllers/useRoomSeatController';
import type { RoomCapabilities } from '@/features/room/model/RoomCapabilities';
import {
  createBotTakeoverCapability,
  createRoomSetupCapabilities,
} from '@/features/room/model/RoomCapabilities';
import type { RoomViewerAudience } from '@/features/room/model/RoomViewer';
import { viewerFor } from '@/test-utils/roomViewer';
import { buildSecrethitlerPhaseStates } from '@/test-utils/secrethitlerState';
import * as alerts from '@/utils/alert';

import { SECRETHITLER_GUIDANCE_MATRIX } from '../secrethitlerGuidanceMatrix';
import { createSecrethitlerRoomShellModel } from '../secrethitlerRoomAdapter';

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

function roomShellModel(
  state: SecrethitlerState,
  audience: RoomViewerAudience,
  controlledSeat: number | null = null,
) {
  const viewer = viewerFor(audience);
  return createSecrethitlerRoomShellModel({
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
    controlledSeat,
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
    openIdentity: vi.fn(),
    openAction: vi.fn(),
    isSubmitting: false,
  });
}

describe('SECRETHITLER_GUIDANCE_MATRIX', () => {
  const phases = buildSecrethitlerPhaseStates();
  it('covers exactly the engine phase list, each exempt cell with a reason', () => {
    expect(Object.keys(SECRETHITLER_GUIDANCE_MATRIX).sort()).toEqual(
      [...SECRETHITLER_PHASES].sort(),
    );
    for (const row of Object.values(SECRETHITLER_GUIDANCE_MATRIX)) {
      for (const cell of Object.values(row)) {
        if (cell.kind === 'exempt') expect(cell.reason.length).toBeGreaterThan(0);
      }
    }
  });

  it.each(SECRETHITLER_PHASES)('holds every viewer cell in phase %s', (phase) => {
    const state = phases.get(phase);
    if (state === undefined) throw new Error(`Real engine fixture missed ${phase}`);
    for (const viewer of ['host', 'seated', 'spectator'] as const) {
      const cell = SECRETHITLER_GUIDANCE_MATRIX[phase][viewer];
      const message = roomShellModel(state, viewer).bottomActions.message;
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

  it("keeps investigation results in the owning seat's private bottom action", () => {
    const state = phases.get('vetoResponse');
    const investigation = state?.lastInvestigation;
    if (state === undefined || investigation === null || investigation === undefined)
      throw new Error('Missing completed investigation fixture');
    const ownerSeat = investigation.presidentSeat;
    const owner = roomShellModel(
      state,
      ownerSeat === 1 ? 'seated' : 'host',
      ownerSeat >= 2 ? ownerSeat : null,
    );
    if (owner.bottomActions.kind !== 'stacked') throw new Error('Expected stacked room actions');
    const action = owner.bottomActions.layout.secondary.find(
      (button) => button.key === 'investigation-result',
    );
    expect(action?.label).toBe('查看调查结果');
    const showAlert = vi.spyOn(alerts, 'showAlert').mockImplementation(() => undefined);
    if (action === undefined || !action.isEnabled) throw new Error('Missing investigation action');
    action.onPress();
    expect(showAlert).toHaveBeenCalledWith(
      '私密调查结果',
      expect.stringContaining(investigation.faction === 'liberal' ? '自由派' : '法西斯阵营'),
      [{ text: '关闭', style: 'cancel' }],
    );
    for (const audience of ['host', 'seated', 'spectator'] as const) {
      if (audience === 'host' && ownerSeat === 0) continue;
      if (audience === 'seated' && ownerSeat === 1) continue;
      const actions = roomShellModel(state, audience).bottomActions;
      if (actions.kind !== 'stacked') throw new Error('Expected stacked room actions');
      expect(actions.layout.secondary.some((button) => button.key === 'investigation-result')).toBe(
        false,
      );
    }
    showAlert.mockRestore();
  });
});
