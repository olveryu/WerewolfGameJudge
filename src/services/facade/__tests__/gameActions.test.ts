import {
  WEREWOLF_STATE_CODEC,
  type WerewolfActionInput,
  type WerewolfPublicCommand,
} from '@werewolf/game-engine';
import type { GameStore } from '@werewolf/game-engine/engine/store';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';

import type { GameActionsContext } from '@/services/facade/gameActions';
import {
  assignRoles,
  boardNominate,
  boardUpvote,
  boardWithdraw,
  clearAllSeats,
  dispatchPreparedAudioAck,
  fillWithBots,
  markAllBotsGroupConfirmed,
  markAllBotsViewed,
  markViewedRole,
  postProgression,
  prepareAudioAck,
  restartGame,
  setAudioPlaying,
  setWolfRobotHunterStatusViewed,
  shareNightReview,
  startNight,
  submitAction,
  submitGroupConfirmAck,
  submitRevealAck,
  updatePlayerProfile,
  updateTemplate,
} from '@/services/facade/gameActions';
import {
  dispatchPreparedRoomCommand,
  dispatchRoomCommand,
  type PreparedRoomCommand,
  prepareRoomCommand,
} from '@/services/facade/roomCommandTransport';

jest.mock('@/services/facade/roomCommandTransport', () => ({
  dispatchPreparedRoomCommand: jest.fn(),
  dispatchRoomCommand: jest.fn(),
  prepareRoomCommand: jest.fn(),
}));

const dispatchMock = jest.mocked(dispatchRoomCommand);
const dispatchPreparedMock = jest.mocked(dispatchPreparedRoomCommand);
const prepareMock = jest.mocked(prepareRoomCommand);

const PREPARED_AUDIO_ACK: PreparedRoomCommand<{ readonly type: 'werewolf.audio.ack' }> =
  Object.freeze({
    roomCode: 'ABCD',
    commandId: 'audio-ack-command',
    command: Object.freeze({ type: 'werewolf.audio.ack' }),
    controlledSeat: null,
  });

function createContext(roomCode: string | null = 'ABCD'): GameActionsContext {
  const state = roomCode === null ? null : { roomCode, templateRoles: ['wolf', 'seer'] };
  return {
    store: {
      getState: jest.fn(() => state),
      applySnapshot: jest.fn(),
    } as unknown as GameStore,
    audioService: {
      preloadForRoles: jest.fn().mockResolvedValue(undefined),
    } as unknown as GameActionsContext['audioService'],
  };
}

function expectCommand(command: WerewolfPublicCommand, controlledSeat: number | null): void {
  expect(dispatchMock).toHaveBeenLastCalledWith(
    expect.objectContaining({
      roomCode: 'ABCD',
      command,
      controlledSeat,
    }),
  );
}

describe('canonical Werewolf command builders', () => {
  beforeEach(() => {
    dispatchMock.mockReset().mockResolvedValue({ success: true });
    dispatchPreparedMock.mockReset().mockResolvedValue({ success: true });
    prepareMock.mockReset().mockReturnValue(PREPARED_AUDIO_ACK);
  });

  it('maps host and room operations exhaustively', async () => {
    const ctx = createContext();
    const template: GameTemplate = {
      name: 'Test',
      numberOfPlayers: 2,
      roles: ['wolf', 'villager'],
      rules: { witchCanSelfHeal: true },
    };

    await assignRoles(ctx);
    expectCommand({ type: 'werewolf.roles.assign' }, null);
    await updateTemplate(ctx, template);
    expectCommand(
      {
        type: 'werewolf.config.update',
        templateRoles: ['wolf', 'villager'],
        rules: { witchCanSelfHeal: true },
      },
      null,
    );
    await restartGame(ctx);
    expectCommand({ type: 'werewolf.game.restart' }, null);
    await clearAllSeats(ctx);
    expectCommand({ type: 'room.seat.clear' }, null);
    await shareNightReview(ctx, [1, 3]);
    expectCommand({ type: 'werewolf.review.share', allowedSeats: [1, 3] }, null);
    await setAudioPlaying(ctx, true);
    expectCommand({ type: 'werewolf.audio.gate', isPlaying: true }, null);
    await postProgression(ctx);
    expectCommand({ type: 'werewolf.progress.request' }, null);
    await fillWithBots(ctx);
    expectCommand({ type: 'room.seat.fillBots' }, null);
    await markAllBotsViewed(ctx);
    expectCommand({ type: 'werewolf.bots.markRolesViewed' }, null);
    await markAllBotsGroupConfirmed(ctx);
    expectCommand({ type: 'werewolf.groupConfirm.ackBots' }, null);
    await boardNominate(ctx, 'Board', ['wolf', 'seer']);
    expectCommand(
      { type: 'werewolf.board.nominate', displayName: 'Board', roles: ['wolf', 'seer'] },
      null,
    );
    await boardUpvote(ctx, 'target-user');
    expectCommand({ type: 'werewolf.board.upvote', targetUserId: 'target-user' }, null);
    await boardWithdraw(ctx);
    expectCommand({ type: 'werewolf.board.withdraw' }, null);
  });

  it('passes controlledSeat only for bot-capable player commands', async () => {
    const ctx = createContext();

    await markViewedRole(ctx, 4);
    expectCommand({ type: 'werewolf.role.view' }, 4);
    await submitRevealAck(ctx, 4);
    expectCommand({ type: 'werewolf.reveal.ack' }, 4);
    await submitGroupConfirmAck(ctx, 4);
    expectCommand({ type: 'werewolf.groupConfirm.ack' }, 4);
    await setWolfRobotHunterStatusViewed(ctx, 4);
    expectCommand({ type: 'werewolf.wolfRobot.ackHunterStatus' }, 4);

    for (const call of dispatchMock.mock.calls) {
      const options = call[0];
      expect(options.command).not.toHaveProperty('userId');
      expect(options.command).not.toHaveProperty('seat');
      expect(options.command).not.toHaveProperty('role');
    }
  });

  it.each<WerewolfActionInput>([
    { kind: 'target', target: 2 },
    { kind: 'multiTarget', targets: [1, 3] },
    { kind: 'confirm', confirmed: false },
    { kind: 'witch', saveTarget: 2, poisonTarget: null },
    { kind: 'card', cardIndex: 1 },
  ])('maps $kind input without actor seat or role authority', async (input) => {
    const ctx = createContext();

    await submitAction(ctx, input, 5);

    expectCommand({ type: 'werewolf.action.submit', input }, 5);
    const command = dispatchMock.mock.calls[0]?.[0].command;
    expect(command).not.toHaveProperty('userId');
    expect(command).not.toHaveProperty('seat');
    expect(command).not.toHaveProperty('role');
  });

  it('maps the canonical profile update object without userId', async () => {
    const ctx = createContext();

    await updatePlayerProfile(ctx, 'Alice', 'avatar', 'frame', 'flair', 'style', 'effect', 'seat');

    expectCommand(
      {
        type: 'room.profile.update',
        profile: {
          displayName: 'Alice',
          avatarUrl: 'avatar',
          avatarFrame: 'frame',
          seatFlair: 'flair',
          nameStyle: 'style',
          roleRevealEffect: 'effect',
          seatAnimation: 'seat',
        },
      },
      null,
    );
  });

  it('preloads audio only after a successful night start', async () => {
    const ctx = createContext();

    await startNight(ctx);

    expectCommand({ type: 'werewolf.night.start' }, null);
    expect(ctx.audioService.preloadForRoles).toHaveBeenCalledWith(['wolf', 'seer']);

    dispatchMock.mockResolvedValueOnce({ success: false, reason: 'invalid_status' });
    jest.mocked(ctx.audioService.preloadForRoles).mockClear();
    await startNight(ctx);
    expect(ctx.audioService.preloadForRoles).not.toHaveBeenCalled();
  });

  it('prepares one typed audio ack envelope and dispatches that exact object', async () => {
    const ctx = createContext();

    const prepared = prepareAudioAck(ctx);
    if (prepared === null) throw new Error('Expected a prepared audio ack');

    expect(prepareMock).toHaveBeenCalledWith({
      roomCode: 'ABCD',
      command: { type: 'werewolf.audio.ack' },
      controlledSeat: null,
    });

    await dispatchPreparedAudioAck(ctx, prepared);

    expect(dispatchPreparedMock).toHaveBeenCalledWith({
      prepared,
      codec: WEREWOLF_STATE_CODEC,
      store: ctx.store,
      label: 'postAudioAck',
    });
    expect(dispatchPreparedMock.mock.calls[0]?.[0].prepared).toBe(prepared);
  });

  it('fails fast when a prepared audio ack is dispatched in another room', async () => {
    const ctx = createContext('WXYZ');

    await expect(dispatchPreparedAudioAck(ctx, PREPARED_AUDIO_ACK)).rejects.toThrow(
      '[FAIL-FAST] Prepared audio ack belongs to room ABCD, not WXYZ',
    );
    expect(dispatchPreparedMock).not.toHaveBeenCalled();
  });

  it('returns NOT_CONNECTED before transport when room state is absent', async () => {
    const ctx = createContext(null);
    const result = await assignRoles(ctx);

    expect(result).toEqual({ success: false, reason: 'NOT_CONNECTED' });
    expect(dispatchMock).not.toHaveBeenCalled();
    expect(prepareAudioAck(ctx)).toBeNull();
    await expect(dispatchPreparedAudioAck(ctx, PREPARED_AUDIO_ACK)).resolves.toEqual({
      success: false,
      reason: 'NOT_CONNECTED',
    });
    expect(prepareMock).not.toHaveBeenCalled();
    expect(dispatchPreparedMock).not.toHaveBeenCalled();
  });
});
