import type { GameState } from '@game-judge/game-engine/games/werewolf/public';
import { GameStatus, getSchema } from '@game-judge/game-engine/games/werewolf/public';
import { act, renderHook } from '@testing-library/react-native';

import type { RoomCommandDispatchOutcome } from '@/features/room/session/types';
import type { UseRoomActionDialogsResult } from '@/games/werewolf/room/useRoomActionDialogs';
import { toWerewolfLocalState } from '@/games/werewolf/state/toWerewolfLocalState';
import {
  domainRejectedRoomCommand,
  rejectedRoomCommand,
  successfulRoomCommand,
} from '@/test-utils/roomCommand';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';

import { useActionOrchestrator } from '../useActionOrchestrator';

type ConfirmCallback = () => void | Promise<void>;

function createDialogs(onConfirmDialog: (callback: ConfirmCallback) => void) {
  return {
    showActionRejectedAlert: jest.fn(),
    showMagicianFirstAlert: jest.fn(),
    showRevealDialog: jest.fn(),
    showConfirmDialog: jest.fn((_title: string, _message: string, callback: ConfirmCallback) =>
      onConfirmDialog(callback),
    ),
    showWolfVoteDialog: jest.fn(),
    showWitchInfoPrompt: jest.fn(),
    showRoleActionPrompt: jest.fn(),
  } satisfies UseRoomActionDialogsResult;
}

function createParams(
  commandResult: RoomCommandDispatchOutcome<GameState>,
  dialogs: UseRoomActionDialogsResult,
) {
  const state = buildWerewolfTestState({ status: GameStatus.Ongoing });
  return {
    gameState: toWerewolfLocalState(state),
    roomStatus: GameStatus.Ongoing,
    currentActionRole: 'seer' as const,
    currentSchema: getSchema('seerCheck'),
    effectiveSeat: 0,
    effectiveRole: 'seer' as const,
    controlledSeat: null,
    actorSeatForUi: 0,
    imActioner: true,
    isAudioPlaying: false,
    myUserId: 'player-0',
    hasPendingActionCommand: false,
    needsContinueOverlay: false,
    firstSwapSeat: null,
    setFirstSwapSeat: jest.fn(),
    setSecondSeat: jest.fn(),
    submitAction: jest.fn(async () => commandResult),
    submitRevealAck: jest.fn(async () => successfulRoomCommand(state)),
    sendWolfRobotHunterStatusViewed: jest.fn(async () => successfulRoomCommand(state)),
    submitGroupConfirmAck: jest.fn(async () => successfulRoomCommand(state)),
    multiSelectedSeats: [1, 2],
    setMultiSelectedSeats: jest.fn(),
    getAutoTriggerIntent: () => null,
    actionDialogs: dialogs,
  } satisfies Parameters<typeof useActionOrchestrator>[0];
}

function requireCallback(callback: ConfirmCallback | null): ConfirmCallback {
  if (callback === null) throw new Error('[TEST] Confirmation callback was not registered');
  return callback;
}

describe('useActionOrchestrator command decisions', () => {
  const state = buildWerewolfTestState({ status: GameStatus.Ongoing });

  it.each<[string, RoomCommandDispatchOutcome<GameState>, boolean]>([
    ['committed success', successfulRoomCommand(state), true],
    ['committed domain rejection', domainRejectedRoomCommand(state, 'invalid_action'), false],
    ['pre-commit rejection', rejectedRoomCommand<GameState>('invalid_session'), false],
    [
      'not decided',
      { kind: 'notDecided', commandId: 'not-decided', reason: 'SERVER_ERROR' },
      false,
    ],
    [
      'delivery unknown',
      { kind: 'deliveryUnknown', commandId: 'unknown', reason: 'NETWORK_ERROR' },
      false,
    ],
  ])(
    'uses the authoritative acceptance state for %s',
    async (_label, commandResult, shouldClear) => {
      let confirmCallback: ConfirmCallback | null = null;
      const dialogs = createDialogs((callback) => {
        confirmCallback = callback;
      });
      const params = createParams(commandResult, dialogs);
      const { result } = renderHook(() => useActionOrchestrator(params));

      await act(async () => {
        await result.current.handleActionIntent({
          type: 'multiSelectConfirm',
          targetSeat: -1,
          targets: [1, 2],
        });
      });
      await act(async () => {
        await requireCallback(confirmCallback)();
      });

      if (shouldClear) {
        expect(params.setMultiSelectedSeats).toHaveBeenCalledWith([]);
      } else {
        expect(params.setMultiSelectedSeats).not.toHaveBeenCalled();
      }
    },
  );

  it('renders reveal data from the committed command snapshot without waiting for a broadcast', async () => {
    let confirmCallback: ConfirmCallback | null = null;
    const dialogs = createDialogs((callback) => {
      confirmCallback = callback;
    });
    const committedState = buildWerewolfTestState({
      status: GameStatus.Ongoing,
      seerReveal: { targetSeat: 3, result: '好人' },
    });
    const params = createParams(successfulRoomCommand(committedState), dialogs);
    const { result } = renderHook(() => useActionOrchestrator(params));

    await act(async () => {
      await result.current.handleActionIntent({
        type: 'reveal',
        targetSeat: 3,
        revealKind: 'seer',
      });
    });
    await act(async () => {
      await requireCallback(confirmCallback)();
    });

    expect(dialogs.showRevealDialog).toHaveBeenCalledWith(
      '查验结果：4号是好人',
      '',
      expect.any(Function),
    );
  });

  it('keeps action interactions locked while a persisted command awaits a decision', () => {
    const dialogs = createDialogs(() => undefined);
    const params = {
      ...createParams(successfulRoomCommand(state), dialogs),
      hasPendingActionCommand: true,
    };

    const { result } = renderHook(() => useActionOrchestrator(params));

    expect(result.current.isActionSubmitting).toBe(true);
  });

  it('does not reopen an automatic action prompt while recovery is pending', () => {
    const dialogs = createDialogs(() => undefined);
    const params = {
      ...createParams(successfulRoomCommand(state), dialogs),
      hasPendingActionCommand: true,
      getAutoTriggerIntent: () => ({ type: 'actionPrompt' as const, targetSeat: -1 }),
    };

    renderHook(() => useActionOrchestrator(params));

    expect(dialogs.showRoleActionPrompt).not.toHaveBeenCalled();
  });
});
