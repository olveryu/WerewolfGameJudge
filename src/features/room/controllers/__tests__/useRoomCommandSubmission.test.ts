import { act, renderHook } from '@testing-library/react-native';

import { useRoomCommandSubmission } from '@/features/room/controllers/useRoomCommandSubmission';
import type { RoomCommandDispatchOutcome } from '@/features/room/session/types';
import {
  rejectedRoomCommand,
  successfulRoomCommand,
  testRoomState,
} from '@/test-utils/roomCommand';
import { showErrorAlert } from '@/utils/alertPresets';

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
    const operation = jest.fn(
      async (): Promise<RoomCommandDispatchOutcome<typeof state>> => rejection,
    );
    const { result } = renderHook(() => useRoomCommandSubmission(getFailureMessage));
    let succeeded: boolean | null = null;

    await act(async () => {
      succeeded = await result.current.submit('清空座位', operation);
    });

    expect(succeeded).toBe(false);
    expect(getFailureMessage).toHaveBeenCalledWith(rejection);
    expect(mockShowErrorAlert).toHaveBeenCalledWith('清空座位失败', '当前状态不允许此操作');
  });
});
