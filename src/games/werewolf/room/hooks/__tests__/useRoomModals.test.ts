/**
 * Tests the night-review report preparation behavior owned by useRoomModals.
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { HookAlertState } from '@/games/werewolf/room/hookAlert';
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

function getShareButton(alert: HookAlertState | null) {
  return alert?.buttons.find((button) => button.text === '分享战报');
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
    // Initial alert shown with loading share button
    expect(getShareButton(result.current.alert)).toMatchObject({ loading: true });
    rerender({ reportScopeKey: 'report-2' });
    unmount();
    await act(async () => {
      complete('old-image');
      await capture;
    });
    // Stale completion must not resurrect the alert
    expect(result.current.alert).toBeNull();
  });

  it('enables mini-program sharing without starting an unused DOM capture', () => {
    mockIsMiniProgram.mockReturnValue(true);
    const beginReportCapture = jest.fn<Promise<string | null>, []>();
    const { result } = renderHook(() => useRoomModals(createDeps(beginReportCapture)));

    act(() => result.current.openNightReview());

    expect(beginReportCapture).not.toHaveBeenCalled();
    expect(result.current.alert).not.toBeNull();
    expect(getShareButton(result.current.alert)).toMatchObject({ loading: false });
  });

  it('keeps report sharing loading while regular Web capture is pending', () => {
    mockIsMiniProgram.mockReturnValue(false);
    const beginReportCapture = jest.fn(() => new Promise<string | null>(() => undefined));
    const { result } = renderHook(() => useRoomModals(createDeps(beginReportCapture)));

    act(() => result.current.openNightReview());

    expect(beginReportCapture).toHaveBeenCalledTimes(1);
    expect(getShareButton(result.current.alert)).toMatchObject({ loading: true });
  });

  it('enables regular Web sharing after capture reports a failure', async () => {
    mockIsMiniProgram.mockReturnValue(false);
    const beginReportCapture = jest.fn<Promise<string | null>, []>().mockResolvedValue(null);
    const { result } = renderHook(() => useRoomModals(createDeps(beginReportCapture)));

    act(() => result.current.openNightReview());
    expect(getShareButton(result.current.alert)).toMatchObject({ loading: true });

    await waitFor(() =>
      expect(getShareButton(result.current.alert)).toMatchObject({ loading: false }),
    );
  });
});
