/**
 * Tests the night-review report preparation behavior owned by useRoomModals.
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useRoomModals } from '@/games/werewolf/room/hooks/useRoomModals';
import { isMiniProgram } from '@/utils/miniProgram';

jest.mock('@/utils/miniProgram', () => ({
  isMiniProgram: jest.fn(),
}));

const mockIsMiniProgram = jest.mocked(isMiniProgram);

function createDeps(
  beginReportCapture: () => Promise<string | null>,
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
    shareNightReviewReport: async () => {
      throw new Error('Unexpected night-review report share call');
    },
  };
}

describe('useRoomModals night-review report preparation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('does not update a replaced report or an unmounted dialog after capture completes', async () => {
    mockIsMiniProgram.mockReturnValue(false);
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
    // Alert shown with loading share button
    expect(result.current.alert?.title).toBe('本局复盘');
    rerender({ reportScopeKey: 'report-2' });
    unmount();
    await act(async () => {
      complete('old-image');
      await capture;
    });
    // No crash, no state update after unmount — alert was cleared on scope change
  });

  it('enables mini-program sharing without starting an unused DOM capture', () => {
    mockIsMiniProgram.mockReturnValue(true);
    const beginReportCapture = jest.fn<Promise<string | null>, []>();
    const { result } = renderHook(() => useRoomModals(createDeps(beginReportCapture)));

    act(() => result.current.openNightReview());

    expect(beginReportCapture).not.toHaveBeenCalled();
    expect(result.current.alert?.title).toBe('本局复盘');
    expect(result.current.alert?.buttons.find(({ text }) => text === '分享战报')).toMatchObject({
      loading: false,
    });
  });

  it('keeps report sharing loading while regular Web capture is pending', () => {
    mockIsMiniProgram.mockReturnValue(false);
    const beginReportCapture = jest.fn(() => new Promise<string | null>(() => undefined));
    const { result } = renderHook(() => useRoomModals(createDeps(beginReportCapture)));

    act(() => result.current.openNightReview());

    expect(beginReportCapture).toHaveBeenCalledTimes(1);
    expect(result.current.alert?.title).toBe('本局复盘');
    expect(result.current.alert?.buttons.find(({ text }) => text === '分享战报')).toMatchObject({
      loading: true,
    });
  });

  it('enables regular Web sharing after capture reports a failure', async () => {
    mockIsMiniProgram.mockReturnValue(false);
    const beginReportCapture = jest.fn<Promise<string | null>, []>().mockResolvedValue(null);
    const { result } = renderHook(() => useRoomModals(createDeps(beginReportCapture)));

    act(() => result.current.openNightReview());
    // First: loading state
    expect(result.current.alert?.buttons.find(({ text }) => text === '分享战报')).toMatchObject({
      loading: true,
    });

    // After capture completes: loading cleared via second setAlert
    await waitFor(() =>
      expect(result.current.alert?.buttons.find(({ text }) => text === '分享战报')).toMatchObject({
        loading: false,
      }),
    );
  });
});
