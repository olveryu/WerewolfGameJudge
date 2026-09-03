/**
 * Tests the night-review report preparation behavior owned by useRoomModals.
 */

import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useRoomModals } from '@/games/werewolf/room/hooks/useRoomModals';
import { showAlert } from '@/utils/alert';
import { isMiniProgram } from '@/utils/miniProgram';

jest.mock('@/utils/alert', () => ({
  ...jest.requireActual<typeof import('@/utils/alert')>('@/utils/alert'),
  showAlert: jest.fn(),
}));

jest.mock('@/utils/miniProgram', () => ({
  isMiniProgram: jest.fn(),
}));

const mockShowAlert = jest.mocked(showAlert);
const mockIsMiniProgram = jest.mocked(isMiniProgram);

function createDeps(
  beginReportCapture: () => Promise<string | null>,
): Parameters<typeof useRoomModals>[0] {
  return {
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

function getShareButton(callIndex: number) {
  return mockShowAlert.mock.calls[callIndex]?.[2]?.find(({ text }) => text === '分享战报');
}

describe('useRoomModals night-review report preparation', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('enables mini-program sharing without starting an unused DOM capture', () => {
    mockIsMiniProgram.mockReturnValue(true);
    const beginReportCapture = jest.fn<Promise<string | null>, []>();
    const { result } = renderHook(() => useRoomModals(createDeps(beginReportCapture)));

    act(() => result.current.openNightReview());

    expect(beginReportCapture).not.toHaveBeenCalled();
    expect(mockShowAlert).toHaveBeenCalledTimes(1);
    expect(getShareButton(0)).toMatchObject({ loading: false });
  });

  it('keeps report sharing loading while regular Web capture is pending', () => {
    mockIsMiniProgram.mockReturnValue(false);
    const beginReportCapture = jest.fn(() => new Promise<string | null>(() => undefined));
    const { result } = renderHook(() => useRoomModals(createDeps(beginReportCapture)));

    act(() => result.current.openNightReview());

    expect(beginReportCapture).toHaveBeenCalledTimes(1);
    expect(mockShowAlert).toHaveBeenCalledTimes(1);
    expect(getShareButton(0)).toMatchObject({ loading: true });
  });

  it('enables regular Web sharing after capture reports a failure', async () => {
    mockIsMiniProgram.mockReturnValue(false);
    const beginReportCapture = jest.fn<Promise<string | null>, []>().mockResolvedValue(null);
    const { result } = renderHook(() => useRoomModals(createDeps(beginReportCapture)));

    act(() => result.current.openNightReview());

    await waitFor(() => expect(mockShowAlert).toHaveBeenCalledTimes(2));
    expect(getShareButton(0)).toMatchObject({ loading: true });
    expect(getShareButton(1)).toMatchObject({ loading: false });
  });
});
