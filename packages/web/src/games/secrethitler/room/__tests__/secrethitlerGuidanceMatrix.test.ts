/**
 * Secrethitler guidance matrix: every (phase × viewer) cell declared in
 * secrethitlerGuidanceMatrix.ts is held true against createSecrethitlerRoomShellModel,
 * with states produced by the real engine (the game ends through the
 * engine's terminal seam).
 */
import {
  getSecrethitlerNightParticipants,
  getSecrethitlerViewModel,
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
import {
  buildSecrethitlerPhaseStates,
  buildSecrethitlerTestLobby,
  sendSecrethitlerSeatCommand,
  startSecrethitlerTestGame,
} from '@/test-utils/secrethitlerState';
import * as alerts from '@/utils/alert';

import { SECRETHITLER_GUIDANCE_MATRIX } from '../secrethitlerGuidanceMatrix';
import { secrethitlerInstruction } from '../secrethitlerPresentation';
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
  it.each([5, 6, 7, 10])(
    'colors only authorized unconfirmed first-night peer avatars for %i players',
    (count) => {
      const nights: SecrethitlerState[] = [];
      const election = startSecrethitlerTestGame(buildSecrethitlerTestLobby(count), (state) => {
        if (state.phase.kind === 'night') nights.push(state);
      });
      const reveal = nights[0];
      if (reveal === undefined) throw new Error('Missing first-night reveal');
      const highlightedSeats = (
        state: SecrethitlerState,
        audience: RoomViewerAudience,
        controlledSeat: number | null = null,
      ) => {
        const source = roomShellModel(state, audience, controlledSeat).seats.source;
        return state.livingSeats.filter((seat) => source.getSeat(seat).highlight === 'danger');
      };
      for (const viewerSeat of reveal.livingSeats) {
        const audience = viewerSeat === 1 ? 'seated' : 'host';
        const controlledSeat = viewerSeat >= 2 ? viewerSeat : null;
        const source = roomShellModel(reveal, audience, controlledSeat).seats.source;
        const viewerRole = reveal.identities[viewerSeat];
        for (const seat of reveal.livingSeats) {
          const targetRole = reveal.identities[seat];
          const canSee =
            (viewerRole === 'fascist' || (viewerRole === 'hitler' && count <= 6)) &&
            seat !== viewerSeat &&
            (targetRole === 'fascist' || targetRole === 'hitler');
          expect(source.getSeat(seat).highlight).toBe(
            canSee ? 'danger' : controlledSeat === seat ? 'controlled' : 'none',
          );
          expect(
            source
              .getSeat(seat)
              .indicators?.markers.some((marker) => marker.key === 'night-reveal'),
          ).toBe(false);
        }
        if (getSecrethitlerNightParticipants(reveal).includes(viewerSeat)) {
          const confirmed = sendSecrethitlerSeatCommand(reveal, viewerSeat, {
            type: 'secrethitler.night.confirm',
            step: 1,
          });
          expect(highlightedSeats(confirmed, audience, controlledSeat)).toEqual([]);
        }
      }
      expect(highlightedSeats(reveal, 'spectator')).toEqual([]);
      for (const state of [buildSecrethitlerTestLobby(count), election]) {
        expect(highlightedSeats(state, 'host')).toEqual([]);
        for (const seat of state.livingSeats.filter((candidate) => candidate >= 2))
          expect(highlightedSeats(state, 'host', seat)).toEqual([]);
      }
      const botParticipant = getSecrethitlerNightParticipants(reveal).find((seat) => seat >= 2);
      if (botParticipant !== undefined) {
        const ownHighlights = highlightedSeats(reveal, 'host');
        expect(highlightedSeats(reveal, 'host', botParticipant).length).toBeGreaterThan(0);
        expect(highlightedSeats(reveal, 'host')).toEqual(ownHighlights);
      }
    },
  );

  it.each([5, 6, 7, 10])('counts only recognition, not narration cues, for %i players', (count) => {
    const nights: SecrethitlerState[] = [];
    startSecrethitlerTestGame(buildSecrethitlerTestLobby(count), (state) => {
      if (state.phase.kind === 'night') nights.push(state);
    });
    expect(nights).toHaveLength(1);
    for (const state of nights) {
      expect(secrethitlerInstruction(state, getSecrethitlerViewModel(state, null))).toEqual({
        message: '等待首夜互认完成',
        action: null,
      });
      const model = roomShellModel(state, 'host');
      expect(model.step).toBe('1');
      expect(model.bottomActions.progress).toEqual({ current: 1, total: 1, label: '坏人互认' });
      const participants = getSecrethitlerNightParticipants(state);
      for (const seat of state.livingSeats) {
        const instruction = secrethitlerInstruction(state, getSecrethitlerViewModel(state, seat));
        expect(instruction.action).toBe(participants.includes(seat) ? '确认信息' : null);
        if (!participants.includes(seat)) expect(instruction.message).toContain('保持闭眼');
      }
      const first = participants[0];
      if (first === undefined) throw new Error('Missing first-night participant');
      const confirmed = sendSecrethitlerSeatCommand(state, first, {
        type: 'secrethitler.night.confirm',
        step: 1,
      });
      const instruction = secrethitlerInstruction(
        confirmed,
        getSecrethitlerViewModel(confirmed, first),
      );
      expect(instruction.action).toBeNull();
      expect(instruction.message).toContain('等待本步其他玩家确认');
      let allConfirmed = state;
      for (const seat of participants)
        allConfirmed = sendSecrethitlerSeatCommand(allConfirmed, seat, {
          type: 'secrethitler.night.confirm',
          step: 1,
        });
      const closing = sendSecrethitlerSeatCommand(allConfirmed, 0, {
        type: 'secrethitler.audio.ack',
        audioBatchId: allConfirmed.audioBatchId,
      });
      expect(closing.phase.kind).toBe('election');
      expect(closing.pendingAudioEffects.map((effect) => effect.audioKey)).toEqual([
        'evil_close',
        'night_end',
      ]);
      expect(roomShellModel(closing, 'host').bottomActions.progress).toBeNull();
      const closingInstruction = secrethitlerInstruction(
        closing,
        getSecrethitlerViewModel(closing, 0),
      );
      expect(closingInstruction.action).toBeNull();
      expect(closingInstruction.message).toContain('闭眼');
    }
  });

  const phases = buildSecrethitlerPhaseStates();
  it('marks a first vote pending but not the optional change after submission', () => {
    const voting = phases.get('voting');
    if (voting === undefined) throw new Error('Missing voting fixture');
    const before = roomShellModel(voting, 'host').bottomActions;
    if (before.kind !== 'stacked') throw new Error('Expected stacked room actions');
    expect(before.layout.primary.find((button) => button.key === 'game-action')).toMatchObject({
      label: '秘密投票',
      isPending: true,
    });
    const voted = sendSecrethitlerSeatCommand(voting, 0, {
      type: 'secrethitler.government.castVote',
      vote: 'ja',
    });
    const after = roomShellModel(voted, 'host').bottomActions;
    if (after.kind !== 'stacked') throw new Error('Expected stacked room actions');
    expect(after.layout.primary.find((button) => button.key === 'game-action')).toMatchObject({
      label: '修改选票',
      isPending: false,
    });
  });

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
