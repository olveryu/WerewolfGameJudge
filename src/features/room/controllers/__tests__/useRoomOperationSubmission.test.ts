import { act, renderHook } from '@testing-library/react-native';

import { useRoomOperationSubmission } from '@/features/room/controllers/useRoomOperationSubmission';
import type { RoomOperationResult } from '@/features/room/model/RoomCapabilities';
import { showErrorAlert } from '@/utils/alertPresets';

jest.mock('@/utils/alertPresets', () => ({
  ...jest.requireActual<typeof import('@/utils/alertPresets')>('@/utils/alertPresets'),
  showErrorAlert: jest.fn(),
}));

const mockShowErrorAlert = showErrorAlert as jest.MockedFunction<typeof showErrorAlert>;

describe('useRoomOperationSubmission', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('presents an authoritative rejection through the supplied game message policy', async () => {
    const rejection: RoomOperationResult = {
      success: false,
      failureKind: 'rejected',
      commandId: 'clear-command',
      reason: 'invalid_status',
    };
    const getFailureMessage = jest.fn(() => '当前状态不允许此操作');
    const operation = jest.fn(async (): Promise<RoomOperationResult> => rejection);
    const { result } = renderHook(() => useRoomOperationSubmission(getFailureMessage));
    let succeeded: boolean | null = null;

    await act(async () => {
      succeeded = await result.current.submit('清空座位', operation);
    });

    expect(succeeded).toBe(false);
    expect(getFailureMessage).toHaveBeenCalledWith(rejection);
    expect(mockShowErrorAlert).toHaveBeenCalledWith('清空座位失败', '当前状态不允许此操作');
  });
});
