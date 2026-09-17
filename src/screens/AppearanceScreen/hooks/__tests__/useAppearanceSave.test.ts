/** Account editor tasks cannot mutate the next editor after disposal. */
import { act, renderHook } from '@testing-library/react-native';
import { toast } from 'sonner-native';

import { showErrorAlert } from '@/utils/alertPresets';

import { useAppearanceSave } from '../useAppearanceSave';

jest.mock('expo-image-picker', () => ({}));
jest.mock('@/utils/alertPresets', () => ({
  showErrorAlert: jest.fn(),
  showConfirmAlert: jest.fn(),
}));

function createParams(): Parameters<typeof useAppearanceSave>[0] {
  return {
    selected: 'default',
    selectedFrame: null,
    selectedFlair: null,
    selectedNameStyle: null,
    selectedEffect: null,
    selectedSeatAnimation: null,
    hasSelection: true,
    customAvatarUrl: null,
    heroEffectId: 'none',
    heroEffectUnlocked: true,
    heroEffectIsEquipped: false,
    heroEffectOptionLabel: '无',
    updateProfile: jest.fn().mockResolvedValue(undefined),
    uploadAvatar: jest.fn().mockResolvedValue('uploaded'),
    refreshUser: jest.fn().mockResolvedValue(undefined),
    activeRoom: { phase: 'idle', isSeated: false, canSwitchAccount: true, canSyncProfile: false },
    goBack: jest.fn(),
  };
}

beforeEach(() => jest.clearAllMocks());

it('stops a completed save after the account editor unmounts', async () => {
  let complete!: () => void;
  const pending = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const params = createParams();
  params.updateProfile = jest.fn(() => pending);
  const { result, unmount } = renderHook(() => useAppearanceSave(params));
  let save!: Promise<void>;
  act(() => {
    save = result.current.handleConfirm();
  });
  unmount();
  await act(async () => {
    complete();
    await save;
  });
  expect(params.refreshUser).not.toHaveBeenCalled();
  expect(params.goBack).not.toHaveBeenCalled();
  expect(toast.success).not.toHaveBeenCalled();
});

it('keeps the draft available after a failed save and permits retry', async () => {
  const params = createParams();
  params.updateProfile = jest
    .fn()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce(undefined);
  const { result } = renderHook(() => useAppearanceSave(params));
  await act(async () => {
    await result.current.handleConfirm();
  });
  expect(showErrorAlert).toHaveBeenCalled();
  expect(params.goBack).not.toHaveBeenCalled();
  expect(result.current.saving).toBe(false);
  await act(async () => {
    await result.current.handleConfirm();
  });
  expect(params.updateProfile).toHaveBeenNthCalledWith(2, { avatarUrl: '' });
  expect(params.goBack).toHaveBeenCalledTimes(1);
});

it('reports account success with room-sync failure without retrying the account write', async () => {
  const params = createParams();
  params.activeRoom = {
    phase: 'ready',
    gameType: 'werewolf',
    isSeated: true,
    canSwitchAccount: false,
    canSyncProfile: true,
    updateProfile: jest.fn().mockResolvedValue({
      kind: 'decided',
      decision: { kind: 'rejected', commandId: 'sync', reason: 'offline' },
    }),
    leaveSeat: jest.fn(),
  };
  const { result } = renderHook(() => useAppearanceSave(params));
  await act(async () => {
    await result.current.handleConfirm();
  });
  expect(params.updateProfile).toHaveBeenCalledTimes(1);
  expect(toast.warning).toHaveBeenCalledWith('形象已保存，游戏内可能需要重新入座刷新');
  expect(showErrorAlert).not.toHaveBeenCalled();
});
