/** Appearance writes cannot mutate the next page after disposal, and a failure keeps the draft. */
import { act, renderHook } from '@testing-library/react';
import { toast } from 'sonner';

import { showErrorAlert } from '@/utils/alertPresets';

import { useAppearanceSave } from '../useAppearanceSave';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), warning: vi.fn(), info: vi.fn() },
}));
vi.mock('@/utils/alertPresets', () => ({ showErrorAlert: vi.fn() }));

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
    updateProfile: vi.fn().mockResolvedValue(undefined),
    uploadAvatar: vi.fn().mockResolvedValue('uploaded'),
    refreshUser: vi.fn().mockResolvedValue(undefined),
    activeRoom: { phase: 'idle', isSeated: false, canSwitchAccount: true, canSyncProfile: false },
    goBack: vi.fn(),
  };
}

beforeEach(() => vi.clearAllMocks());

it('stops a completed save after the page unmounts', async () => {
  let complete!: () => void;
  const pending = new Promise<void>((resolve) => {
    complete = resolve;
  });
  const params = { ...createParams(), updateProfile: vi.fn(() => pending) };
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
  const params = {
    ...createParams(),
    updateProfile: vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(undefined),
  };
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
  const roomUpdateProfile = vi.fn().mockResolvedValue({
    kind: 'decided',
    decision: { kind: 'rejected', commandId: 'sync', reason: 'offline' },
  });
  const { result } = renderHook(() =>
    useAppearanceSave({
      ...params,
      activeRoom: {
        phase: 'ready',
        gameType: 'werewolf',
        isSeated: true,
        canSwitchAccount: false,
        canSyncProfile: true,
        updateProfile: roomUpdateProfile,
        leaveSeat: vi.fn(),
      },
    }),
  );
  await act(async () => {
    await result.current.handleConfirm();
  });
  expect(params.updateProfile).toHaveBeenCalledTimes(1);
  expect(roomUpdateProfile).toHaveBeenCalledWith({ avatarUrl: '' });
  expect(toast.warning).toHaveBeenCalledWith('形象已保存，游戏内可能需要重新入座刷新');
  expect(showErrorAlert).not.toHaveBeenCalled();
});

it('uploads the picked file, then refreshes the account and leaves the page', async () => {
  const params = createParams();
  const { result } = renderHook(() => useAppearanceSave(params));
  const file = new File(['avatar'], 'avatar.png', { type: 'image/png' });
  await act(async () => {
    await result.current.handleUpload(file);
  });
  expect(params.uploadAvatar).toHaveBeenCalledWith(file);
  expect(params.refreshUser).toHaveBeenCalledTimes(1);
  expect(toast.success).toHaveBeenCalledWith('头像已更新');
  expect(params.goBack).toHaveBeenCalledTimes(1);
});
