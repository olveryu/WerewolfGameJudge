import { act, renderHook } from '@testing-library/react-native';
import { toast } from 'sonner-native';

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

jest.mock('sonner-native', () => ({ toast: { error: jest.fn() } }));

jest.mock('@/utils/alertPresets', () => ({
  ...jest.requireActual<typeof import('@/utils/alertPresets')>('@/utils/alertPresets'),
  showErrorAlert: jest.fn(),
}));

const mockShowErrorAlert = showErrorAlert as jest.MockedFunction<typeof showErrorAlert>;
const state = testRoomState('werewolf');

describe('useRoomCommandSubmission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts only an authoritative committed success', async () => {
    const operation = jest.fn(async () => successfulRoomCommand(state, 'clear-command'));
    const getFailureMessage = jest.fn(() => '不应读取失败文案');
    const { result } = renderHook(() => useRoomCommandSubmission(getFailureMessage));
    let succeeded: boolean | null = null;

    await act(async () => {
      succeeded = await result.current.submit('清空座位', operation);
    });

    expect(succeeded).toBe(true);
    expect(getFailureMessage).not.toHaveBeenCalled();
    expect(mockShowErrorAlert).not.toHaveBeenCalled();
  });

  it('presents an authoritative rejection through the supplied game message policy', async () => {
    const rejection = rejectedRoomCommand<typeof state>('invalid_status', 'clear-command');
    const getFailureMessage = jest.fn(() => '当前状态不允许此操作');
    const operation = jest.fn(async (): Promise<DispatchOutcome<typeof state>> => rejection);
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
    const getFailureMessage = jest.fn(() => '不应读取失败文案');
    const operation = jest.fn(async (): Promise<DispatchOutcome<typeof state>> => rejection);
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
    const getFailureMessage = jest.fn(() => '当前行动步骤已变化，请重新选择');
    const operation = jest.fn(async (): Promise<DispatchOutcome<typeof state>> => rejection);
    const { result } = renderHook(() => useRoomCommandSubmission(getFailureMessage));

    await act(async () => {
      await result.current.submit('操作', operation, { domainRejection: 'state' });
    });

    expect(mockShowErrorAlert).toHaveBeenCalledWith('操作失败', '当前行动步骤已变化，请重新选择');
  });

  it('alerts an undelivered command regardless of the rejection presentation', async () => {
    const outcome = undeliveredRoomCommand<typeof state>('network', 'night-command');
    const getFailureMessage = jest.fn(() => '网络异常，请检查网络后重试');
    const operation = jest.fn(async (): Promise<DispatchOutcome<typeof state>> => outcome);
    const { result } = renderHook(() => useRoomCommandSubmission(getFailureMessage));

    await act(async () => {
      await result.current.submit('操作', operation, { domainRejection: 'state' });
    });

    expect(mockShowErrorAlert).toHaveBeenCalledWith('操作失败', '网络异常，请检查网络后重试');
  });

  it('toastAndRethrow: an undelivered command toasts and rejects so an open dialog stays up for retry', async () => {
    const outcome = undeliveredRoomCommand<typeof state>('network', 'night-command');
    const getFailureMessage = jest.fn(() => '网络异常，请检查网络后重试');
    const operation = jest.fn(async (): Promise<DispatchOutcome<typeof state>> => outcome);
    const { result } = renderHook(() => useRoomCommandSubmission(getFailureMessage));

    await act(async () => {
      await expect(
        result.current.submit('确认查验结果', operation, { transportFailure: 'toastAndRethrow' }),
      ).rejects.toMatchObject({ name: 'RoomCommandUndeliveredError' });
    });

    expect(jest.mocked(toast.error)).toHaveBeenCalledWith('网络异常，请检查网络后重试');
    expect(mockShowErrorAlert).not.toHaveBeenCalled();
    expect(result.current.isSubmitting).toBe(false);
  });

  it('toastAndRethrow: a thrown transport error toasts and rethrows the same error', async () => {
    const error = new Error('socket closed');
    const operation = jest.fn(async (): Promise<DispatchOutcome<typeof state>> => {
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
    const operation = jest.fn(async (): Promise<DispatchOutcome<typeof state>> => rejection);
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
