/**
 * useRoomModals: the review-access grant picker and the last-night-info
 * confirmation chain. The review itself (confirmation, dialog, image
 * share) is the shared useRoomReview and is tested with the platform.
 */

import { act, renderHook } from '@testing-library/react';

import { useRoomModals } from '@/games/werewolf/room/hooks/useRoomModals';
import { showAlert, showAlertWithGeneration } from '@/utils/alert';

vi.mock('@/utils/alert', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/utils/alert')>()),
  showAlert: vi.fn(),
  showAlertWithGeneration: vi.fn(),
}));

const mockShowAlert = vi.mocked(showAlert);
const mockShowAlertWithGeneration = vi.mocked(showAlertWithGeneration);

function createDeps(
  overrides: Partial<Parameters<typeof useRoomModals>[0]> = {},
): Parameters<typeof useRoomModals>[0] {
  return {
    gameSequence: 0,
    getLastNightInfo: () => '',
    getCurseInfo: () => null,
    grantReviewAccess: async () => {
      throw new Error('Unexpected review grant');
    },
    isGameEnded: false,
    onLastNightInfoConfirmed: async () => true,
    ...overrides,
  };
}

describe('useRoomModals review-access grant picker', () => {
  it('opens and closes the picker', () => {
    const { result } = renderHook(() => useRoomModals(createDeps()));
    expect(result.current.isGrantVisible).toBe(false);

    act(() => result.current.openGrant());
    expect(result.current.isGrantVisible).toBe(true);

    act(() => result.current.closeGrant());
    expect(result.current.isGrantVisible).toBe(false);
  });

  it('closes the picker once the grant is committed, and keeps it open when it is not', async () => {
    const grantReviewAccess = vi
      .fn<(seats: readonly number[]) => Promise<boolean>>()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const { result } = renderHook(() => useRoomModals(createDeps({ grantReviewAccess })));
    act(() => result.current.openGrant());

    await act(() => result.current.grantSeatsAccess([2]));
    expect(grantReviewAccess).toHaveBeenLastCalledWith([2]);
    expect(result.current.isGrantVisible).toBe(true);

    await act(() => result.current.grantSeatsAccess([2, 4]));
    expect(result.current.isGrantVisible).toBe(false);
  });

  it('belongs to the game it opened in: a new game hides it', () => {
    const { result, rerender } = renderHook(
      (props: { readonly gameSequence: number }) => useRoomModals(createDeps(props)),
      { initialProps: { gameSequence: 3 } },
    );
    act(() => result.current.openGrant());
    expect(result.current.isGrantVisible).toBe(true);

    rerender({ gameSequence: 4 });
    expect(result.current.isGrantVisible).toBe(false);
  });

  it('does not close a picker reopened in a newer game when an older grant commits', async () => {
    let commit: (value: boolean) => void = () => undefined;
    const grantReviewAccess = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          commit = resolve;
        }),
    );
    const { result, rerender } = renderHook(
      (props: { readonly gameSequence: number }) =>
        useRoomModals(createDeps({ ...props, grantReviewAccess })),
      { initialProps: { gameSequence: 1 } },
    );
    act(() => result.current.openGrant());
    let pending: Promise<void> = Promise.resolve();
    act(() => {
      pending = result.current.grantSeatsAccess([0]);
    });

    rerender({ gameSequence: 2 });
    act(() => result.current.openGrant());
    await act(async () => {
      commit(true);
      await pending;
    });
    expect(result.current.isGrantVisible).toBe(true);
  });
});

describe('useRoomModals last-night info confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function pressLastNightInfoConfirm() {
    const confirmCall = mockShowAlertWithGeneration.mock.calls.find(
      (call) => call[0] === '查看昨夜信息？',
    );
    const confirmButton = confirmCall?.[2]?.find(({ text }) => text === '查看');
    expect(confirmButton).toBeDefined();
    act(() => {
      void confirmButton?.onPress?.();
    });
  }

  it('completes the flow only after the info has been viewed and acknowledged', () => {
    const onLastNightInfoConfirmed = vi.fn(async () => true);
    const deps = createDeps({
      getLastNightInfo: () => '昨夜平安夜',
      onLastNightInfoConfirmed,
    });
    const { result } = renderHook(() => useRoomModals(deps));

    act(() => result.current.showLastNightInfo());

    expect(mockShowAlertWithGeneration).toHaveBeenCalledWith(
      '查看昨夜信息？',
      '昨夜信息可能影响警长竞选。',
      [expect.objectContaining({ text: '取消' }), expect.objectContaining({ text: '查看' })],
    );
    expect(onLastNightInfoConfirmed).not.toHaveBeenCalled();

    pressLastNightInfoConfirm();

    expect(onLastNightInfoConfirmed).not.toHaveBeenCalled();
    expect(mockShowAlert).toHaveBeenCalledWith('昨夜信息', '昨夜平安夜', expect.anything());
    const infoCall = mockShowAlert.mock.calls.find((call) => call[0] === '昨夜信息');
    act(() => {
      void infoCall?.[2]?.find(({ text }) => text === '知道了')?.onPress?.();
    });
    expect(onLastNightInfoConfirmed).toHaveBeenCalledTimes(1);
  });

  it('offers the crow curse from the info dialog when a crow is on the board', async () => {
    const onLastNightInfoConfirmed = vi.fn(async () => true);
    const deps = createDeps({
      getLastNightInfo: () => '昨夜平安夜',
      getCurseInfo: () => '3号被诅咒（放逐+1票）',
      onLastNightInfoConfirmed,
    });
    const { result } = renderHook(() => useRoomModals(deps));

    act(() => result.current.showLastNightInfo());
    pressLastNightInfoConfirm();

    const infoCall = mockShowAlert.mock.calls.find((call) => call[0] === '昨夜信息');
    expect(infoCall?.[2]?.map(({ text }) => text)).toEqual(['查看诅咒', '知道了']);
    expect(onLastNightInfoConfirmed).not.toHaveBeenCalled();
    await act(async () => {
      await infoCall?.[2]?.find(({ text }) => text === '查看诅咒')?.onPress?.();
    });
    expect(onLastNightInfoConfirmed).toHaveBeenCalledTimes(1);
    expect(mockShowAlertWithGeneration).toHaveBeenCalledWith(
      '乌鸦诅咒',
      '3号被诅咒（放逐+1票）',
      expect.anything(),
    );
  });

  it('does not replace a failed acknowledgement with the curse dialog', async () => {
    const { result } = renderHook(() =>
      useRoomModals(
        createDeps({
          getCurseInfo: () => '诅咒',
          onLastNightInfoConfirmed: async () => false,
        }),
      ),
    );
    act(() => result.current.showLastNightInfo());
    pressLastNightInfoConfirm();
    const infoCall = mockShowAlert.mock.calls.find((call) => call[0] === '昨夜信息');
    await act(async () => {
      await infoCall?.[2]?.find(({ text }) => text === '查看诅咒')?.onPress?.();
    });
    expect(mockShowAlertWithGeneration).not.toHaveBeenCalledWith(
      '乌鸦诅咒',
      expect.anything(),
      expect.anything(),
    );
  });

  it('drops the election warning once the game has ended', () => {
    const deps = createDeps({ isGameEnded: true });
    const { result } = renderHook(() => useRoomModals(deps));

    act(() => result.current.showLastNightInfo());

    expect(mockShowAlertWithGeneration).toHaveBeenCalledWith(
      '查看昨夜信息？',
      '',
      expect.any(Array),
    );
  });
});
