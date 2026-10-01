/** Verify shared title gestures and the admin identity gate without game state. */

import { act, renderHook } from '@testing-library/react-native';

import { AdminApiError, getAdminWhoAmI } from '@/features/admin/services/adminApi';
import { showAlert } from '@/utils/alert';
import { debugLogStore } from '@/utils/debugLogStore';
import { handleError } from '@/utils/errorPipeline';

import { useRoomTitleActions } from '../useRoomTitleActions';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('@/features/admin/services/adminApi', () => ({
  ...jest.requireActual<typeof import('@/features/admin/services/adminApi')>(
    '@/features/admin/services/adminApi',
  ),
  getAdminWhoAmI: jest.fn(),
}));
jest.mock('@/utils/alert', () => ({ showAlert: jest.fn() }));
jest.mock('@/utils/errorPipeline', () => ({ handleError: jest.fn() }));
jest.mock('@/utils/debugLogStore', () => ({
  debugLogStore: { toggleVisibility: jest.fn() },
}));

const mockGetAdminWhoAmI = jest.mocked(getAdminWhoAmI);

describe('useRoomTitleActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    mockGetAdminWhoAmI.mockResolvedValue({ userId: 'admin', isSuperAdmin: true });
  });

  afterEach(() => jest.useRealTimers());

  it('ignores the first three taps and navigates on the fourth without opening logs', () => {
    const { result } = renderHook(useRoomTitleActions);
    act(() => {
      result.current.handleTitlePress();
      result.current.handleTitlePress();
      result.current.handleTitlePress();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(200);
      result.current.handleTitlePress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('Admin');
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(mockGetAdminWhoAmI).not.toHaveBeenCalled();
    expect(debugLogStore.toggleVisibility).not.toHaveBeenCalled();
  });

  it('does not combine taps outside the consecutive-tap interval', () => {
    const { result } = renderHook(useRoomTitleActions);
    act(() => {
      result.current.handleTitlePress();
      result.current.handleTitlePress();
      result.current.handleTitlePress();
      jest.advanceTimersByTime(3001);
      result.current.handleTitlePress();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('toggles the debug log on long press when the caller is an admin', async () => {
    const { result } = renderHook(useRoomTitleActions);
    await act(async () => {
      result.current.handleTitlePress();
      result.current.handleTitlePress();
      result.current.handleTitlePress();
      result.current.handleTitleLongPress();
    });
    act(() => result.current.handleTitlePress());
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(mockGetAdminWhoAmI).toHaveBeenCalledTimes(1);
    expect(debugLogStore.toggleVisibility).toHaveBeenCalledTimes(1);
  });

  it('rejects non-admin long presses with feedback and keeps logs closed', async () => {
    mockGetAdminWhoAmI.mockRejectedValueOnce(new AdminApiError(403, 'FORBIDDEN'));
    const { result } = renderHook(useRoomTitleActions);
    await act(async () => result.current.handleTitleLongPress());
    expect(showAlert).toHaveBeenCalledWith('打开调试日志失败', '需要管理员权限');
    expect(debugLogStore.toggleVisibility).not.toHaveBeenCalled();
  });

  it('reports verification errors and permits retry', async () => {
    const error = new Error('verification failed');
    mockGetAdminWhoAmI.mockRejectedValueOnce(error);
    const { result } = renderHook(useRoomTitleActions);
    await act(async () => result.current.handleTitleLongPress());
    expect(handleError).toHaveBeenCalledWith(
      error,
      expect.objectContaining({ label: '打开调试日志' }),
    );
    expect(debugLogStore.toggleVisibility).not.toHaveBeenCalled();
    await act(async () => result.current.handleTitleLongPress());
    expect(debugLogStore.toggleVisibility).toHaveBeenCalledTimes(1);
  });
});
