/** Verify shared title gestures and the admin credential gate without game state. */

import { act, renderHook } from '@testing-library/react-native';

import { verifyAdminPassword } from '@/features/admin/services/adminApi';
import {
  clearAdminCredential,
  readAdminCredential,
  writeAdminCredential,
} from '@/features/admin/services/adminCredentialStore';
import type { RoomAlertConfig } from '@/features/room/components/RoomAlertContext';
import { debugLogStore } from '@/utils/debugLogStore';
import { handleError } from '@/utils/errorPipeline';

import { useRoomTitleActions } from '../useRoomTitleActions';

const mockShowRoomAlert = jest.fn<void, [RoomAlertConfig]>();
jest.mock('@/features/room/components/RoomAlertContext', () => ({
  useRoomAlert: () => ({
    showRoomAlert: mockShowRoomAlert,
    clearRoomAlert: jest.fn(),
  }),
  useOptionalRoomAlert: () => null,
}));

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({ navigate: mockNavigate }),
}));
jest.mock('@/features/admin/services/adminApi');
jest.mock('@/features/admin/services/adminCredentialStore');
jest.mock('@/utils/errorPipeline', () => ({
  handleError: jest.fn(() => ({ message: '', isExpected: true, aborted: true })),
}));
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
    expect(verifyAdminPassword).not.toHaveBeenCalled();
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

  it('verifies a long press and clears the pending single tap', async () => {
    const { result } = renderHook(useRoomTitleActions);
    await act(async () => {
      result.current.handleTitlePress();
      result.current.handleTitlePress();
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
    expect(mockShowRoomAlert).toHaveBeenCalledWith({
      title: '打开调试日志失败',
      message: '管理员密码无效，请重试',
      buttons: [{ text: '确定', style: 'default' }],
    });
    expect(debugLogStore.toggleVisibility).not.toHaveBeenCalled();
  });

  it('prompts and verifies before caching credentials and opening logs', async () => {
    jest.mocked(readAdminCredential).mockReturnValue(null);
    const { result } = renderHook(useRoomTitleActions);
    act(() => result.current.handleTitleLongPress());
    expect(mockShowRoomAlert).toHaveBeenCalledTimes(1);
    const promptConfig = mockShowRoomAlert.mock.calls[0]![0];
    expect(promptConfig.title).toBe('管理员密码');
    expect(promptConfig.input).toEqual({ placeholder: '请输入管理员密码' });
    expect(promptConfig.buttons.map((b) => b.text)).toEqual(['取消', '确定']);
    expect(debugLogStore.toggleVisibility).not.toHaveBeenCalled();
    const confirmButton = promptConfig.buttons.find((b) => b.text === '确定')!;
    await act(async () => confirmButton.onPress?.(' new-password '));
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
