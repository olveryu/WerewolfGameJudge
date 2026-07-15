import { type WerewolfActionInput, type WerewolfPublicCommand } from '@werewolf/game-engine';
import { GameStatus } from '@werewolf/game-engine/models/GameStatus';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import { createRoomSnapshot } from '@werewolf/game-engine/platform/protocol/roomSnapshot';
import type { GameState } from '@werewolf/game-engine/protocol/types';

import type {
  PreparedRoomCommand,
  RoomCommandDispatchOutcome,
} from '@/features/room/session/types';
import {
  assignRoles,
  boardNominate,
  boardUpvote,
  boardWithdraw,
  dispatchPreparedAudioAck,
  type GameActionsContext,
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
  updateTemplate,
} from '@/games/werewolf/runtime/werewolfGameActions';

import { buildApiTestState } from './apiTestState';

type AudioAckCommand = Extract<WerewolfPublicCommand, { readonly type: 'werewolf.audio.ack' }>;

interface DispatchCommandOptions {
  readonly controlledSeat: number | null;
  readonly label: string;
}

const dispatchMock = jest.fn<
  Promise<RoomCommandDispatchOutcome<GameState>>,
  [WerewolfPublicCommand, DispatchCommandOptions]
>();
const dispatchPreparedMock = jest.fn<
  Promise<RoomCommandDispatchOutcome<GameState>>,
  [PreparedRoomCommand<AudioAckCommand>, string]
>();
const prepareMock = jest.fn<
  PreparedRoomCommand<AudioAckCommand>,
  [AudioAckCommand, number | null]
>();

const PREPARED_AUDIO_ACK: PreparedRoomCommand<AudioAckCommand> = Object.freeze({
  sessionEpoch: 1,
  roomCode: 'ABCD',
  roomId: 'room-id-abcd',
  commandId: 'audio-ack-command',
  command: Object.freeze({ type: 'werewolf.audio.ack' }),
  controlledSeat: null,
});

const STATE = buildApiTestState({
  roomCode: 'ABCD',
  status: GameStatus.Seated,
  templateRoles: ['wolf', 'seer'],
});

function decidedSuccess(): RoomCommandDispatchOutcome<GameState> {
  return {
    kind: 'decided',
    decision: {
      kind: 'committed',
      commandId: 'command-id',
      snapshot: createRoomSnapshot(STATE, 1),
      outcome: { kind: 'success' },
    },
  };
}

function decidedRejection(reason: string): RoomCommandDispatchOutcome<GameState> {
  return {
    kind: 'decided',
    decision: { kind: 'rejected', commandId: 'command-id', reason },
  };
}

function createContext(): GameActionsContext {
  return {
    getState: jest.fn(() => STATE),
    audio: {
      playBeginning: jest.fn().mockResolvedValue(undefined),
      playEnding: jest.fn().mockResolvedValue(undefined),
      playNight: jest.fn().mockResolvedValue(undefined),
      playNightEnd: jest.fn().mockResolvedValue(undefined),
      preloadRoles: jest.fn().mockResolvedValue(undefined),
      stopNarration: jest.fn(),
      stopBgm: jest.fn(),
      clearPreloaded: jest.fn(),
    },
    commands: {
      dispatch: dispatchMock,
      dispatchPrepared: dispatchPreparedMock,
      prepare: prepareMock,
    } as unknown as GameActionsContext['commands'],
  };
}

function expectCommand(command: WerewolfPublicCommand, controlledSeat: number | null): void {
  expect(dispatchMock).toHaveBeenLastCalledWith(
    command,
    expect.objectContaining({ controlledSeat }),
  );
}

describe('canonical Werewolf command builders', () => {
  beforeEach(() => {
    dispatchMock.mockReset().mockResolvedValue(decidedSuccess());
    dispatchPreparedMock.mockReset().mockResolvedValue(decidedSuccess());
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
    await shareNightReview(ctx, [1, 3]);
    expectCommand({ type: 'werewolf.review.share', allowedSeats: [1, 3] }, null);
    await setAudioPlaying(ctx, true);
    expectCommand({ type: 'werewolf.audio.gate', isPlaying: true }, null);
    await postProgression(ctx);
    expectCommand({ type: 'werewolf.progress.request' }, null);
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
      const command = call[0];
      expect(command).not.toHaveProperty('userId');
      expect(command).not.toHaveProperty('seat');
      expect(command).not.toHaveProperty('role');
    }
  });

  it.each<WerewolfActionInput>([
    { kind: 'target', target: 2 },
    { kind: 'multiTarget', targets: [1, 3] },
    { kind: 'confirm' },
    { kind: 'witch', saveTarget: 2, poisonTarget: null },
    { kind: 'card', cardIndex: 1 },
    { kind: 'skip' },
  ])('maps $kind input without actor seat or role authority', async (input) => {
    const ctx = createContext();

    await submitAction(ctx, input, 5);

    expectCommand({ type: 'werewolf.action.submit', input }, 5);
    const command = dispatchMock.mock.calls[0]?.[0];
    expect(command).not.toHaveProperty('userId');
    expect(command).not.toHaveProperty('seat');
    expect(command).not.toHaveProperty('role');
  });

  it('preloads audio only after a successful night start', async () => {
    const ctx = createContext();

    await startNight(ctx);

    expectCommand({ type: 'werewolf.night.start' }, null);
    expect(ctx.audio.preloadRoles).toHaveBeenCalledWith(['wolf', 'seer']);

    dispatchMock.mockResolvedValueOnce(decidedRejection('invalid_status'));
    jest.mocked(ctx.audio.preloadRoles).mockClear();
    await startNight(ctx);
    expect(ctx.audio.preloadRoles).not.toHaveBeenCalled();
  });

  it('prepares one typed audio ack envelope and dispatches that exact object', async () => {
    const ctx = createContext();

    const prepared = prepareAudioAck(ctx);
    expect(prepareMock).toHaveBeenCalledWith({ type: 'werewolf.audio.ack' }, null);

    await dispatchPreparedAudioAck(ctx, prepared);

    expect(dispatchPreparedMock).toHaveBeenCalledWith(prepared, 'postAudioAck');
    expect(dispatchPreparedMock.mock.calls[0]?.[0]).toBe(prepared);
  });

  it('propagates an inactive-session failure instead of fabricating NOT_CONNECTED', async () => {
    const ctx = createContext();
    dispatchMock.mockRejectedValueOnce(new Error('[FAIL-FAST] Room session is not active'));

    await expect(assignRoles(ctx)).rejects.toThrow('[FAIL-FAST] Room session is not active');
  });
});
