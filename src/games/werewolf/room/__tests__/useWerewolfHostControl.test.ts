/**
 * Tests for useWerewolfHostControl hook — the host flow commands
 * (assign / start / abort / redeal / return-to-lobby) on the shared
 * command pipeline: confirm dialogs keep their copy, submission goes
 * through useRoomCommandSubmission (single-flight lock + shared
 * failure alert). Both terminal flows pass the share-report ritual;
 * which command the confirm submits is the flow the host picked.
 */
import { act, renderHook } from '@testing-library/react-native';

import { useWerewolfHostControl } from '@/games/werewolf/room/useWerewolfHostControl';
import type { WerewolfCommandDispatchOutcome } from '@/games/werewolf/runtime/WerewolfGameClient';
import { domainRejectedRoomCommand, successfulRoomCommand } from '@/test-utils/roomCommand';
import { buildWerewolfTestState } from '@/test-utils/werewolfState';
import { showAlert } from '@/utils/alert';
import { handleError } from '@/utils/errorPipeline';

// Mock showAlert (confirm dialogs and the submission failure alert both
// surface through it)
jest.mock('@/utils/alert', () => ({
  ...jest.requireActual<typeof import('@/utils/alert')>('@/utils/alert'),
  showAlert: jest.fn(),
}));

jest.mock('@/utils/errorPipeline', () => ({
  handleError: jest.fn(),
}));

const mockShowAlert = showAlert as jest.MockedFunction<typeof showAlert>;
const mockHandleError = handleError as jest.MockedFunction<typeof handleError>;

type AlertButton = { text: string; onPress?: () => unknown };

const lastAlertButtons = (): AlertButton[] => {
  const call = mockShowAlert.mock.calls[mockShowAlert.mock.calls.length - 1]!;
  return call[2]!;
};

const pressButton = (text: string): unknown => {
  const button = lastAlertButtons().find((b) => b.text === text);
  expect(button).toBeDefined();
  return button?.onPress?.();
};

const renderControl = (overrides: Partial<Parameters<typeof useWerewolfHostControl>[0]> = {}) =>
  renderHook(() =>
    useWerewolfHostControl({
      assignRoles: jest.fn().mockResolvedValue(successfulRoomCommand(buildWerewolfTestState())),
      startGame: jest.fn().mockResolvedValue(successfulRoomCommand(buildWerewolfTestState())),
      restartGame: jest.fn().mockResolvedValue(successfulRoomCommand(buildWerewolfTestState())),
      redealGame: jest.fn().mockResolvedValue(successfulRoomCommand(buildWerewolfTestState())),
      shareNightReviewReport: jest.fn().mockResolvedValue(true),
      ...overrides,
    }),
  );

describe('useWerewolfHostControl', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('showPrepareToFlipDialog', () => {
    it('shows the confirm dialog and submits assignRoles on confirm', async () => {
      const assignRoles = jest
        .fn()
        .mockResolvedValue(successfulRoomCommand(buildWerewolfTestState()));
      const { result } = renderControl({ assignRoles });

      act(() => {
        result.current.showPrepareToFlipDialog();
      });

      expect(mockShowAlert).toHaveBeenCalledWith(
        '分配角色？',
        '所有座位已满，将洗牌并分配角色',
        expect.arrayContaining([
          expect.objectContaining({ text: '确定' }),
          expect.objectContaining({ text: '取消', style: 'cancel' }),
        ]),
      );

      await act(async () => {
        await pressButton('确定');
      });

      expect(assignRoles).toHaveBeenCalledTimes(1);
      expect(result.current.isSubmitting).toBe(false);
    });

    it('presents a rejected outcome through the shared failure alert with the server reason', async () => {
      const assignRoles = jest
        .fn()
        .mockResolvedValue(
          domainRejectedRoomCommand(buildWerewolfTestState(), 'role_count_mismatch'),
        );
      const { result } = renderControl({ assignRoles });

      act(() => {
        result.current.showPrepareToFlipDialog();
      });
      await act(async () => {
        await pressButton('确定');
      });

      expect(assignRoles).toHaveBeenCalledTimes(1);
      expect(mockShowAlert).toHaveBeenCalledWith('分配角色失败', '角色数量与座位数不匹配');
      expect(mockHandleError).not.toHaveBeenCalled();
    });

    it('routes a thrown error to handleError with the failure alert message', async () => {
      const thrown = new Error('network down');
      const assignRoles = jest.fn().mockRejectedValue(thrown);
      const { result } = renderControl({ assignRoles });

      act(() => {
        result.current.showPrepareToFlipDialog();
      });
      await act(async () => {
        await pressButton('确定');
      });

      expect(mockHandleError).toHaveBeenCalledWith(
        thrown,
        expect.objectContaining({
          label: '分配角色',
          alertMessage: '分配角色失败，请稍后重试',
        }),
      );
      expect(result.current.isSubmitting).toBe(false);
    });

    it('locks submission while in flight and rejects a second confirm', async () => {
      let resolveAssign!: (outcome: WerewolfCommandDispatchOutcome) => void;
      const assignRoles = jest.fn(
        () => new Promise<WerewolfCommandDispatchOutcome>((resolve) => (resolveAssign = resolve)),
      );
      const { result } = renderControl({ assignRoles });

      expect(result.current.isSubmitting).toBe(false);
      act(() => {
        result.current.showPrepareToFlipDialog();
      });

      let firstPress: unknown;
      act(() => {
        firstPress = pressButton('确定');
      });
      expect(assignRoles).toHaveBeenCalledTimes(1);
      expect(result.current.isSubmitting).toBe(true);

      // Second confirm while the first is still in flight: the shared
      // submission lock throws instead of dispatching again.
      await expect(pressButton('确定') as Promise<unknown>).rejects.toThrow('already in progress');
      expect(assignRoles).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveAssign(successfulRoomCommand(buildWerewolfTestState()));
        await firstPress;
      });
      expect(result.current.isSubmitting).toBe(false);
    });
  });

  describe('showStartGameDialog', () => {
    it('shows the volume confirm dialog and tracks isStartingGame while in flight', async () => {
      let resolveStart!: (outcome: WerewolfCommandDispatchOutcome) => void;
      const startGame = jest.fn(
        () => new Promise<WerewolfCommandDispatchOutcome>((resolve) => (resolveStart = resolve)),
      );
      const { result } = renderControl({ startGame });

      expect(result.current.isStartingGame).toBe(false);
      act(() => {
        result.current.showStartGameDialog();
      });

      expect(mockShowAlert).toHaveBeenCalledWith(
        '开始游戏？',
        '请将手机音量调到最大',
        expect.arrayContaining([
          expect.objectContaining({ text: '确定' }),
          expect.objectContaining({ text: '取消', style: 'cancel' }),
        ]),
      );

      let press: unknown;
      act(() => {
        press = pressButton('确定');
      });
      expect(startGame).toHaveBeenCalledTimes(1);
      expect(result.current.isStartingGame).toBe(true);
      expect(result.current.isSubmitting).toBe(true);

      await act(async () => {
        resolveStart(successfulRoomCommand(buildWerewolfTestState()));
        await press;
      });
      expect(result.current.isStartingGame).toBe(false);
      expect(result.current.isSubmitting).toBe(false);
    });
  });

  describe('showAbortDialog', () => {
    it('shows the abort confirm dialog and submits restart on confirm', async () => {
      const restartGame = jest
        .fn()
        .mockResolvedValue(successfulRoomCommand(buildWerewolfTestState()));
      const shareNightReviewReport = jest.fn().mockResolvedValue(true);
      const { result } = renderControl({ restartGame, shareNightReviewReport });

      act(() => {
        result.current.showAbortDialog();
      });

      expect(mockShowAlert).toHaveBeenCalledWith(
        '中止本局？',
        '本局不计胜负，保留座位和板子，清除已分配的角色。',
        expect.arrayContaining([
          expect.objectContaining({ text: '确定' }),
          expect.objectContaining({ text: '取消', style: 'cancel' }),
        ]),
      );

      await act(async () => {
        await pressButton('确定');
      });
      expect(restartGame).toHaveBeenCalledTimes(1);
      expect(shareNightReviewReport).not.toHaveBeenCalled();
    });
  });

  describe('terminal flows (share-report ritual)', () => {
    it('redeal: offers share first, confirm submits redeal only', async () => {
      const restartGame = jest
        .fn()
        .mockResolvedValue(successfulRoomCommand(buildWerewolfTestState()));
      const redealGame = jest
        .fn()
        .mockResolvedValue(successfulRoomCommand(buildWerewolfTestState()));
      const shareNightReviewReport = jest.fn().mockResolvedValue(true);
      const { result } = renderControl({ restartGame, redealGame, shareNightReviewReport });

      act(() => {
        result.current.showRedealDialog();
      });

      expect(mockShowAlert).toHaveBeenCalledWith(
        '再来一局',
        '本局复盘将无法查看，是否先分享战报？',
        expect.arrayContaining([
          expect.objectContaining({ text: '分享战报' }),
          expect.objectContaining({ text: '再来一局' }),
          expect.objectContaining({ text: '取消', style: 'cancel' }),
        ]),
      );

      // Share branch: shares the report, submits nothing.
      await act(async () => {
        await pressButton('分享战报');
      });
      expect(shareNightReviewReport).toHaveBeenCalledTimes(1);
      expect(redealGame).not.toHaveBeenCalled();
      expect(restartGame).not.toHaveBeenCalled();

      // Confirm branch: submits the redeal command only.
      await act(async () => {
        await pressButton('再来一局');
      });
      expect(redealGame).toHaveBeenCalledTimes(1);
      expect(restartGame).not.toHaveBeenCalled();
    });

    it('return-to-lobby: offers share first, confirm submits restart only', async () => {
      const restartGame = jest
        .fn()
        .mockResolvedValue(successfulRoomCommand(buildWerewolfTestState()));
      const redealGame = jest
        .fn()
        .mockResolvedValue(successfulRoomCommand(buildWerewolfTestState()));
      const shareNightReviewReport = jest.fn().mockResolvedValue(true);
      const { result } = renderControl({ restartGame, redealGame, shareNightReviewReport });

      act(() => {
        result.current.showReturnToLobbyDialog();
      });

      expect(mockShowAlert).toHaveBeenCalledWith(
        '返回大厅',
        '本局复盘将无法查看，是否先分享战报？',
        expect.arrayContaining([
          expect.objectContaining({ text: '分享战报' }),
          expect.objectContaining({ text: '返回大厅' }),
          expect.objectContaining({ text: '取消', style: 'cancel' }),
        ]),
      );

      await act(async () => {
        await pressButton('分享战报');
      });
      expect(shareNightReviewReport).toHaveBeenCalledTimes(1);
      expect(restartGame).not.toHaveBeenCalled();
      expect(redealGame).not.toHaveBeenCalled();

      await act(async () => {
        await pressButton('返回大厅');
      });
      expect(restartGame).toHaveBeenCalledTimes(1);
      expect(redealGame).not.toHaveBeenCalled();
    });

    it('rejects a second redeal press while the first is in flight', async () => {
      let resolveRedeal!: (outcome: WerewolfCommandDispatchOutcome) => void;
      const redealGame = jest.fn(
        () => new Promise<WerewolfCommandDispatchOutcome>((resolve) => (resolveRedeal = resolve)),
      );
      const { result } = renderControl({ redealGame });

      act(() => {
        result.current.showRedealDialog();
      });

      let firstPress: unknown;
      await act(async () => {
        firstPress = pressButton('再来一局');
      });
      expect(redealGame).toHaveBeenCalledTimes(1);
      expect(result.current.isSubmitting).toBe(true);

      await expect(pressButton('再来一局') as Promise<unknown>).rejects.toThrow(
        'already in progress',
      );
      expect(redealGame).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveRedeal(successfulRoomCommand(buildWerewolfTestState()));
        await firstPress;
      });
      expect(result.current.isSubmitting).toBe(false);
    });
  });
});
