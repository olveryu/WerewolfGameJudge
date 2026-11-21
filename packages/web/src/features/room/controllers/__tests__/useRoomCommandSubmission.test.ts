import { act, renderHook } from '@testing-library/react';
import { toast } from 'sonner';
import type { MockedFunction } from 'vitest';

import { useRoomCommandSubmission } from '@/features/room/controllers/useRoomCommandSubmission';
import type { DispatchOutcome } from '@/platform/realtime/types';
import {
  domainRejectedRoomCommand,
  rejectedRoomCommand,
  successfulRoomCommand,
  testRoomState,
  undeliveredRoomCommand,
} from '@/test-utils/roomCommand';
import { showErrorAlert } from '@/utils/alertPresets';

vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));

vi.mock('@/utils/alertPresets', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/alertPresets')>()),
  showErrorAlert: vi.fn(),
}));

const mockShowErrorAlert = showErrorAlert as MockedFunction<typeof showErrorAlert>;
const state = testRoomState('werewolf');

describe('useRoomCommandSubmission', () => {
  it('lets an opt-in inline presenter handle decisions but never hides transport failures', async () => {
    const onRejection = vi.fn(() => true);
    const { result } = renderHook(() => useRoomCommandSubmission(() => '请重试'));
    await act(async () => {
      await result.current.submit('操作', async () => rejectedRoomCommand('stale'), {
        onRejection,
      });
    });
    expect(onRejection).toHaveBeenCalledWith('stale', '请重试');
    expect(mockShowErrorAlert).not.toHaveBeenCalled();
    onRejection.mockClear();
    await act(async () => {
      await result.current.submit('操作', async () => undeliveredRoomCommand(), { onRejection });
    });
    expect(onRejection).not.toHaveBeenCalled();
    expect(mockShowErrorAlert).toHaveBeenCalledWith('操作失败', '请重试');
  });

  it('keeps the default error when the inline presenter declines a rejection', async () => {
    const { result } = renderHook(() => useRoomCommandSubmission(() => '权限不足'));
    await act(async () => {
      await result.current.submit('操作', async () => rejectedRoomCommand('forbidden'), {
        onRejection: () => false,
      });
    });
    expect(mockShowErrorAlert).toHaveBeenCalledWith('操作失败', '权限不足');
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('accepts only an authoritative committed success', async () => {
    const operation = vi.fn(async () => successfulRoomCommand(state, 'clear-command'));
    const getFailureMessage = vi.fn(() => '不应读取失败文案');
    const { result } = renderHook(() => useRoomCommandSubmission(getFailureMessage));
    let succeeded: boolean | null = null;

    await act(async () => {
      succeeded = await result.current.submit('清空座位', operation);
    });

    expect(succeeded).toBe(true);
    expect(getFailureMessage).not.toHaveBeenCalled();
    expect(mockShowErrorAlert).not.toHaveBeenCalled();
  });

  it('exposes and clears the key of the action currently being submitted', async () => {
    let resolveOperation!: (outcome: DispatchOutcome<typeof state>) => void;
    const operation = new Promise<DispatchOutcome<typeof state>>((resolve) => {
      resolveOperation = resolve;
    });
    const { result } = renderHook(() => useRoomCommandSubmission(() => '请重试'));
    let submission!: Promise<boolean>;

    act(() => {
      submission = result.current.submit('开始游戏', () => operation, { actionKey: 'start-game' });
    });
    expect(result.current.isSubmitting).toBe(true);
    expect(result.current.pendingActionKey).toBe('start-game');

    await act(async () => {
      resolveOperation(successfulRoomCommand(state, 'start-command'));
      await submission;
    });
    expect(result.current.isSubmitting).toBe(false);
    expect(result.current.pendingActionKey).toBeNull();
  });

  it('presents an authoritative rejection through the supplied game message policy', async () => {
    const rejection = rejectedRoomCommand<typeof state>('invalid_status', 'clear-command');
    const getFailureMessage = vi.fn(() => '当前状态不允许此操作');
    const operation = vi.fn(async (): Promise<DispatchOutcome<typeof state>> => rejection);
    const { result } = renderHook(() => useRoomCommandSubmission(getFailureMessage));
    let succeeded: boolean | null = null;

    await act(async () => {
      succeeded = await result.current.submit('清空座位', operation);
    });

    expect(succeeded).toBe(false);
    expect(getFailureMessage).toHaveBeenCalledWith(rejection);
    expect(mockShowErrorAlert).toHaveBeenCalledWith('清空座位失败', '当前状态不允许此操作');
  });

  it('leaves a committed domain rejection to the game when it presents it from state', async () => {
    const rejection = domainRejectedRoomCommand(state, '目标玩家不存在', 'night-command');
    const getFailureMessage = vi.fn(() => '不应读取失败文案');
    const operation = vi.fn(async (): Promise<DispatchOutcome<typeof state>> => rejection);
    const { result } = renderHook(() => useRoomCommandSubmission(getFailureMessage));
    let succeeded: boolean | null = null;

    await act(async () => {
      succeeded = await result.current.submit('操作', operation, { domainRejection: 'state' });
    });

    expect(succeeded).toBe(false);
    expect(mockShowErrorAlert).not.toHaveBeenCalled();
  });

  it('still alerts a pre-commit rejection when domain rejections are presented from state', async () => {
    const rejection = rejectedRoomCommand<typeof state>('action_step_changed', 'night-command');
    const getFailureMessage = vi.fn(() => '当前行动步骤已变化，请重新选择');
    const operation = vi.fn(async (): Promise<DispatchOutcome<typeof state>> => rejection);
    const { result } = renderHook(() => useRoomCommandSubmission(getFailureMessage));

    await act(async () => {
      await result.current.submit('操作', operation, { domainRejection: 'state' });
    });

    expect(mockShowErrorAlert).toHaveBeenCalledWith('操作失败', '当前行动步骤已变化，请重新选择');
  });

  it('alerts an undelivered command regardless of the rejection presentation', async () => {
    const outcome = undeliveredRoomCommand<typeof state>('network', 'night-command');
    const getFailureMessage = vi.fn(() => '网络异常，请检查网络后重试');
    const operation = vi.fn(async (): Promise<DispatchOutcome<typeof state>> => outcome);
    const { result } = renderHook(() => useRoomCommandSubmission(getFailureMessage));

    await act(async () => {
      await result.current.submit('操作', operation, { domainRejection: 'state' });
    });

    expect(mockShowErrorAlert).toHaveBeenCalledWith('操作失败', '网络异常，请检查网络后重试');
  });

  it('toastAndRethrow: an undelivered command toasts and rejects so an open dialog stays up for retry', async () => {
    const outcome = undeliveredRoomCommand<typeof state>('network', 'night-command');
    const getFailureMessage = vi.fn(() => '网络异常，请检查网络后重试');
    const operation = vi.fn(async (): Promise<DispatchOutcome<typeof state>> => outcome);
    const { result } = renderHook(() => useRoomCommandSubmission(getFailureMessage));

    await act(async () => {
      await expect(
        result.current.submit('确认查验结果', operation, { transportFailure: 'toastAndRethrow' }),
      ).rejects.toMatchObject({ name: 'RoomCommandUndeliveredError' });
    });

    expect(vi.mocked(toast.error)).toHaveBeenCalledWith('网络异常，请检查网络后重试');
    expect(mockShowErrorAlert).not.toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);
  });

  it('toastAndRethrow: a thrown transport error toasts and rethrows the same error', async () => {
    const error = new Error('socket closed');
    const operation = vi.fn(async (): Promise<DispatchOutcome<typeof state>> => {
      throw error;
    });
    const { result } = renderHook(() => useRoomCommandSubmission(() => '不应读取失败文案'));

    await act(async () => {
      await expect(
        result.current.submit('确认查验结果', operation, { transportFailure: 'toastAndRethrow' }),
      ).rejects.toBe(error);
    });
    expect(mockShowErrorAlert).not.toHaveBeenCalled();
  });

  it('toastAndRethrow never rethrows a decision: a rejection resolves false and alerts', async () => {
    const rejection = rejectedRoomCommand<typeof state>('action_step_changed', 'night-command');
    const operation = vi.fn(async (): Promise<DispatchOutcome<typeof state>> => rejection);
    const { result } = renderHook(() => useRoomCommandSubmission(() => '当前行动步骤已变化'));
    let succeeded: boolean | null = null;

    await act(async () => {
      succeeded = await result.current.submit('操作', operation, {
        transportFailure: 'toastAndRethrow',
      });
    });

    expect(succeeded).toBe(false);
    expect(mockShowErrorAlert).toHaveBeenCalledWith('操作失败', '当前行动步骤已变化');
  });
});
