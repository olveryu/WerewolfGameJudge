/** Verify shared title gestures and the admin credential gate without game state. */

import { act, renderHook } from '@testing-library/react-native';

import { verifyAdminPassword } from '@/features/admin/services/adminApi';
import {
  clearAdminCredential,
  readAdminCredential,
  writeAdminCredential,
} from '@/features/admin/services/adminCredentialStore';
import { showAlert, showPrompt } from '@/utils/alert';
import { debugLogStore } from '@/utils/debugLogStore';
import { handleError } from '@/utils/errorPipeline';

import { useRoomTitleActions } from '../useRoomTitleActions';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('@/features/admin/services/adminApi');
jest.mock('@/features/admin/services/adminCredentialStore');
jest.mock('@/utils/alert', () => ({ showAlert: jest.fn(), showPrompt: jest.fn() }));
jest.mock('@/utils/errorPipeline', () => ({ handleError: jest.fn() }));
jest.mock('@/utils/debugLogStore', () => ({
  debugLogStore: { toggleVisibility: jest.fn() },
}));

describe('useRoomTitleActions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.mocked(readAdminCredential).mockReturnValue('test-password');
    jest.mocked(verifyAdminPassword).mockResolvedValue(true);
  });

  afterEach(() => jest.useRealTimers());

  it('ignores a single tap and navigates on a double tap without opening logs', () => {
    const { result } = renderHook(useRoomTitleActions);
    act(() => result.current.handleTitlePress());
    expect(mockNavigate).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(200);
      result.current.handleTitlePress();
    });
    expect(mockNavigate).toHaveBeenCalledWith('Admin');
    expect(mockNavigate).toHaveBeenCalledTimes(1);
    expect(verifyAdminPassword).not.toHaveBeenCalled();
    expect(debugLogStore.toggleVisibility).not.toHaveBeenCalled();
  });

  it('does not combine taps outside the double-tap interval', () => {
    const { result } = renderHook(useRoomTitleActions);
    act(() => {
      result.current.handleTitlePress();
      jest.advanceTimersByTime(301);
      result.current.handleTitlePress();
    });
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('verifies a long press and clears the pending single tap', async () => {
    const { result } = renderHook(useRoomTitleActions);
    await act(async () => {
      result.current.handleTitlePress();
      result.current.handleTitleLongPress();
    });
    act(() => result.current.handleTitlePress());
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(verifyAdminPassword).toHaveBeenCalledWith('test-password');
    expect(debugLogStore.toggleVisibility).toHaveBeenCalledTimes(1);
  });

  it('rejects invalid cached credentials with feedback', async () => {
    jest.mocked(verifyAdminPassword).mockResolvedValue(false);
    const { result } = renderHook(useRoomTitleActions);
    await act(async () => result.current.handleTitleLongPress());
    expect(clearAdminCredential).toHaveBeenCalledTimes(1);
    expect(showAlert).toHaveBeenCalledWith('打开调试日志失败', expect.any(String));
    expect(debugLogStore.toggleVisibility).not.toHaveBeenCalled();
  });

  it('prompts and verifies before caching credentials and opening logs', async () => {
    jest.mocked(readAdminCredential).mockReturnValue(null);
    const { result } = renderHook(useRoomTitleActions);
    act(() => result.current.handleTitleLongPress());
    expect(showPrompt).toHaveBeenCalledWith('Admin 密码', expect.any(Object));
    expect(debugLogStore.toggleVisibility).not.toHaveBeenCalled();
    const options = jest.mocked(showPrompt).mock.calls[0]![1];
    await act(async () => options.onConfirm(' new-password '));
    expect(verifyAdminPassword).toHaveBeenCalledWith('new-password');
    expect(writeAdminCredential).toHaveBeenCalledWith('new-password');
    expect(debugLogStore.toggleVisibility).toHaveBeenCalledTimes(1);
  });

  it('reports verification errors and permits retry', async () => {
    const error = new Error('verification failed');
    jest.mocked(verifyAdminPassword).mockRejectedValueOnce(error);
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
