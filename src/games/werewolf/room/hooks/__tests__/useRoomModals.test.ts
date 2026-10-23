/**
 * Tests the night-review report preparation behavior owned by useRoomModals.
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { ReportCaptureProgress } from '@/games/werewolf/room/hooks/useNightReviewShare';
import { useRoomModals } from '@/games/werewolf/room/hooks/useRoomModals';
import { showAlert } from '@/utils/alert';

jest.mock('@/utils/alert', () => ({
  ...jest.requireActual<typeof import('@/utils/alert')>('@/utils/alert'),
  showAlert: jest.fn(),
}));

const mockShowAlert = jest.mocked(showAlert);

function createDeps(
  beginReportCapture: () => Promise<string | null>,
  overrides: Partial<Parameters<typeof useRoomModals>[0]> = {},
): Parameters<typeof useRoomModals>[0] {
  return {
    reportScopeKey: 'report-1',
    isHost: true,
    canShareReport: true,
    getLastNightInfo: () => '',
    getCurseInfo: () => null,
    shareNightReview: async () => {
      throw new Error('Unexpected night-review authorization call');
    },
    beginReportCapture,
    reportCaptureProgress: null,
    shareNightReviewReport: async () => {
      throw new Error('Unexpected night-review report share call');
    },
    isGameEnded: false,
    onLastNightInfoConfirmed: () => undefined,
    ...overrides,
  };
}

function getShareButton(callIndex: number) {
  return mockShowAlert.mock.calls[callIndex]?.[2]?.find(({ text }) => text === '分享战报');
}

describe('useRoomModals night-review report preparation', () => {
  it('does not update a replaced report or an unmounted dialog after capture completes', async () => {
    let complete!: (value: string | null) => void;
    const capture = new Promise<string | null>((resolve) => {
      complete = resolve;
    });
    const deps = createDeps(() => capture);
    const { result, rerender, unmount } = renderHook(
      ({ reportScopeKey }: { reportScopeKey: string }) =>
        useRoomModals({ ...deps, reportScopeKey }),
      { initialProps: { reportScopeKey: 'report-1' } },
    );
    act(() => result.current.openNightReview());
    rerender({ reportScopeKey: 'report-2' });
    unmount();
    await act(async () => {
      complete('old-image');
      await capture;
    });
    expect(mockShowAlert).toHaveBeenCalledTimes(1);
  });
  beforeEach(() => {
    jest.clearAllMocks();
    mockShowAlert.mockReturnValue(true);
  });

  it('starts pre-capture on open for every platform and enables sharing when it completes', async () => {
    const beginReportCapture = jest.fn<Promise<string | null>, []>().mockResolvedValue('image');
    const { result } = renderHook(() => useRoomModals(createDeps(beginReportCapture)));

    act(() => result.current.openNightReview());

    expect(beginReportCapture).toHaveBeenCalledTimes(1);
    expect(mockShowAlert).toHaveBeenCalledTimes(1);
    expect(getShareButton(0)).toMatchObject({ loading: true });

    await waitFor(() => expect(mockShowAlert).toHaveBeenCalledTimes(2));
    expect(getShareButton(1)).toMatchObject({ loading: false });
  });

  it('keeps report sharing loading while capture is pending', () => {
    const beginReportCapture = jest.fn(() => new Promise<string | null>(() => undefined));
    const { result } = renderHook(() => useRoomModals(createDeps(beginReportCapture)));

    act(() => result.current.openNightReview());

    expect(beginReportCapture).toHaveBeenCalledTimes(1);
    expect(mockShowAlert).toHaveBeenCalledTimes(1);
    expect(getShareButton(0)).toMatchObject({ loading: true });
  });

  it('enables sharing after capture reports a failure', async () => {
    const beginReportCapture = jest.fn<Promise<string | null>, []>().mockResolvedValue(null);
    const { result } = renderHook(() => useRoomModals(createDeps(beginReportCapture)));

    act(() => result.current.openNightReview());

    await waitFor(() => expect(mockShowAlert).toHaveBeenCalledTimes(2));
    expect(getShareButton(0)).toMatchObject({ loading: true });
    expect(getShareButton(1)).toMatchObject({ loading: false });
  });

  it('shows live band progress on the share button while the detail alert is open', () => {
    const beginReportCapture = jest.fn(() => new Promise<string | null>(() => undefined));
    const deps = createDeps(beginReportCapture);
    const { result, rerender } = renderHook(
      ({ progress }: { progress: ReportCaptureProgress | null }) =>
        useRoomModals({ ...deps, reportCaptureProgress: progress }),
      { initialProps: { progress: null as ReportCaptureProgress | null } },
    );

    act(() => result.current.openNightReview());
    expect(mockShowAlert).toHaveBeenCalledTimes(1);

    rerender({ progress: { done: 1, total: 3 } });

    expect(mockShowAlert).toHaveBeenCalledTimes(2);
    const progressButton = mockShowAlert.mock.calls[1]?.[2]?.find(({ text }) =>
      text.startsWith('生成中'),
    );
    expect(progressButton).toMatchObject({ text: '生成中 1/3 段', loading: true });
  });

  it('does not re-show the detail alert for progress once it was dismissed', () => {
    const beginReportCapture = jest.fn(() => new Promise<string | null>(() => undefined));
    const deps = createDeps(beginReportCapture);
    const { result, rerender } = renderHook(
      ({ progress }: { progress: ReportCaptureProgress | null }) =>
        useRoomModals({ ...deps, reportCaptureProgress: progress }),
      { initialProps: { progress: null as ReportCaptureProgress | null } },
    );

    act(() => result.current.openNightReview());
    const cancelButton = mockShowAlert.mock.calls[0]?.[2]?.find(({ text }) => text === '取消');
    act(() => {
      void cancelButton?.onPress?.();
    });

    rerender({ progress: { done: 2, total: 3 } });

    expect(mockShowAlert).toHaveBeenCalledTimes(1);
  });
});

describe('useRoomModals last-night info confirmation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockShowAlert.mockReturnValue(true);
  });

  function pressLastNightInfoConfirm() {
    const confirmCall = mockShowAlert.mock.calls.find((call) => call[0] === '提示');
    const confirmButton = confirmCall?.[2]?.find(({ text }) => text === '确定查看');
    expect(confirmButton).toBeDefined();
    act(() => {
      void confirmButton?.onPress?.();
    });
  }

  it('warns about the sheriff election mid-game and completes the flow step on confirm', () => {
    const onLastNightInfoConfirmed = jest.fn();
    const deps = createDeps(async () => null, {
      getLastNightInfo: () => '昨夜平安夜',
      onLastNightInfoConfirmed,
    });
    const { result } = renderHook(() => useRoomModals(deps));

    act(() => result.current.showLastNightInfo());

    expect(mockShowAlert).toHaveBeenCalledWith(
      '提示',
      '昨夜信息可能影响警长竞选，请确认是否现在查看。',
      expect.anything(),
    );
    expect(onLastNightInfoConfirmed).not.toHaveBeenCalled();

    pressLastNightInfoConfirm();

    expect(onLastNightInfoConfirmed).toHaveBeenCalledTimes(1);
    expect(mockShowAlert).toHaveBeenCalledWith('昨夜信息', '昨夜平安夜', expect.anything());
  });

  it('drops the election warning once the game has ended', () => {
    const deps = createDeps(async () => null, { isGameEnded: true });
    const { result } = renderHook(() => useRoomModals(deps));

    act(() => result.current.showLastNightInfo());

    const confirmCall = mockShowAlert.mock.calls.find((call) => call[0] === '提示');
    expect(confirmCall?.[1]).toBe('请确认是否现在查看昨夜信息。');
    expect(confirmCall?.[1]).not.toContain('警长竞选');
  });
});
