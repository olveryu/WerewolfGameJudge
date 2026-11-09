/**
 * useRoomReview: the one review integration. Pins the entry per
 * availability, the confirmation gate, the dialog and its pager, the share
 * controls per permission/drawing/export state, background capture while
 * the dialog is open, and the reset when the reviewed round changes.
 */

import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { toast } from 'sonner';

import type { RoomViewer } from '@/features/room/model/RoomViewer';
import { captureElementPngBase64 } from '@/features/room/services/captureElementPng';
import { shareImagesBase64 } from '@/features/room/services/shareImage';
import { TESTIDS } from '@/testids';
import { showConfirmAlert } from '@/utils/alertPresets';

import type { RoomReviewAvailability, RoomReviewContribution, RoomReviewDocument } from '../types';
import { type RoomReviewController, useRoomReview } from '../useRoomReview';
import { imageBlock, page, reviewDocument, twoPageDocument } from './reviewFixtures';

vi.mock('@/features/room/services/captureElementPng', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/room/services/captureElementPng')>()),
  captureElementPngBase64: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
vi.mock('@/features/room/services/shareImage', () => ({
  shareImagesBase64: vi.fn(),
  uploadShareImages: vi.fn(),
  previewUploadedImages: vi.fn(),
}));
vi.mock('@/utils/miniProgram', () => ({ isMiniProgram: () => false }));
vi.mock('@/utils/alertPresets', () => ({ showConfirmAlert: vi.fn() }));
vi.mock('@/utils/errorPipeline', () => ({ handleError: vi.fn() }));

const mockCapture = vi.mocked(captureElementPngBase64);
const mockShare = vi.mocked(shareImagesBase64);
const mockConfirm = vi.mocked(showConfirmAlert);

const VIEWER: RoomViewer = { userId: 'user-1', isHost: false, seat: 2 };

type TestState = { readonly availability: RoomReviewAvailability };

const contribution: RoomReviewContribution<TestState> = {
  resolve: ({ state }) => state.availability,
};

function available(
  document: RoomReviewDocument,
  overrides: Partial<Extract<RoomReviewAvailability, { readonly kind: 'available' }>> = {},
): TestState {
  return {
    availability: {
      kind: 'available',
      document,
      sharing: { isAllowed: true },
      confirmation: null,
      ...overrides,
    },
  };
}

let latest: RoomReviewController | null = null;

function current(): RoomReviewController {
  if (latest === null) throw new Error('harness not rendered');
  return latest;
}

function capture(review: RoomReviewController) {
  latest = review;
}

function Harness({
  state,
  onOpened = null,
  onRender = capture,
}: {
  readonly state: TestState;
  readonly onOpened?: (() => void) | null;
  readonly onRender?: (review: RoomReviewController) => void;
}) {
  const review = useRoomReview({
    contribution,
    state,
    viewer: VIEWER,
    roomId: 'room-1',
    roomCode: '1234',
    onOpened,
  });
  onRender(review);
  return <>{review.overlay}</>;
}

beforeEach(() => {
  vi.clearAllMocks();
  latest = null;
});

describe('useRoomReview entry', () => {
  it('has no entry before the round ends', () => {
    render(<Harness state={{ availability: { kind: 'notEnded' } }} />);
    expect(current().entry).toBeNull();
  });

  it('disables the entry with the reason for a viewer who may not read the review', () => {
    render(
      <Harness
        state={{ availability: { kind: 'notPermitted', reason: '房主尚未向你开放复盘' } }}
      />,
    );
    expect(current().entry).toEqual({ isEnabled: false, disabledReason: '房主尚未向你开放复盘' });
    expect(() => current().open(null)).toThrow('[FAIL-FAST] Review opened while notPermitted');
  });

  it('fails fast on a document that breaks the structure rules', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Harness state={available(reviewDocument({ pages: [] }))} />)).toThrow(
      '[FAIL-FAST] Review demo-1234-1 has no pages',
    );
  });
});

describe('useRoomReview dialog', () => {
  it('opens on the entry press and reports the opening', () => {
    const onOpened = vi.fn();
    render(
      <Harness
        state={available(reviewDocument(), {
          sharing: { isAllowed: false, reason: '仅房主可分享' },
        })}
        onOpened={onOpened}
      />,
    );
    const { entry } = current();
    if (entry === null || !entry.isEnabled) throw new Error('expected an enabled entry');

    act(() => entry.onPress());
    expect(screen.getByTestId(TESTIDS.roomReviewDialog)).toBeTruthy();
    expect(screen.getByText('本局复盘')).toBeTruthy();
    expect(screen.getByText('🌙 第一夜 · 夜报')).toBeTruthy();
    expect(onOpened).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByLabelText('关闭详情'));
    expect(screen.queryByTestId(TESTIDS.roomReviewDialog)).toBeNull();
  });

  it('asks the game confirmation first and opens only once confirmed', () => {
    const onOpened = vi.fn();
    render(
      <Harness
        state={available(reviewDocument(), {
          sharing: { isAllowed: false, reason: '仅房主可分享' },
          confirmation: {
            title: '查看本局复盘？',
            message: '包含全员身份',
            confirmText: '确定查看',
          },
        })}
        onOpened={onOpened}
      />,
    );
    act(() => current().open(null));
    expect(mockConfirm).toHaveBeenCalledWith(
      '查看本局复盘？',
      '包含全员身份',
      expect.any(Function),
      {
        confirmText: '确定查看',
      },
    );
    expect(screen.queryByTestId(TESTIDS.roomReviewDialog)).toBeNull();
    expect(onOpened).not.toHaveBeenCalled();

    const confirm = mockConfirm.mock.calls[0]?.[2];
    act(() => {
      void confirm?.();
    });
    expect(screen.getByTestId(TESTIDS.roomReviewDialog)).toBeTruthy();
    expect(onOpened).toHaveBeenCalledTimes(1);
  });

  it('opens a multi-page document at a page and pages through it', () => {
    render(
      <Harness
        state={available(twoPageDocument(), { sharing: { isAllowed: false, reason: '不可分享' } })}
      />,
    );
    act(() => current().open('album-2'));
    expect(screen.getByText('第 2 篇 · 小红的画册')).toBeTruthy();
    expect(screen.getByText('起手词：梨')).toBeTruthy();

    fireEvent.click(screen.getByLabelText('上一页'));
    expect(screen.getByText('第 1 篇 · 小明的画册')).toBeTruthy();
    expect(screen.getByText('起手词：苹果')).toBeTruthy();
  });

  it('fails fast on a page the document does not have', () => {
    render(<Harness state={available(twoPageDocument())} />);
    expect(() => current().open('album-9')).toThrow(
      '[FAIL-FAST] Review demo-1234-1 has no page album-9',
    );
  });

  it('closes when the reviewed round changes', () => {
    const view = render(
      <Harness
        state={available(reviewDocument(), { sharing: { isAllowed: false, reason: 'x' } })}
      />,
    );
    act(() => current().open(null));
    expect(screen.getByTestId(TESTIDS.roomReviewDialog)).toBeTruthy();

    view.rerender(
      <Harness
        state={available(reviewDocument({ roundKey: 'round-2' }), {
          sharing: { isAllowed: false, reason: 'x' },
        })}
      />,
    );
    expect(screen.queryByTestId(TESTIDS.roomReviewDialog)).toBeNull();
  });
});

describe('useRoomReview share controls', () => {
  it('shows a reader who may not export the disabled button and why', () => {
    render(
      <Harness
        state={available(reviewDocument(), {
          sharing: { isAllowed: false, reason: '仅房主和已获授权的玩家可以分享战报' },
        })}
      />,
    );
    act(() => current().open(null));
    expect(screen.getByTestId(TESTIDS.roomReviewShareButton)).toBeDisabled();
    expect(screen.getByText('仅房主和已获授权的玩家可以分享战报')).toBeTruthy();
    expect(screen.queryByTestId(TESTIDS.roomReviewStagePage('only'))).toBeNull();
    expect(() => current().shareAll()).toThrow(
      '[FAIL-FAST] Review shared without a document this viewer may share',
    );
  });

  it('captures in the background while open, then shares at once on press', async () => {
    mockCapture.mockResolvedValue('png');
    mockShare.mockResolvedValue('downloaded');
    render(<Harness state={available(reviewDocument())} />);
    act(() => current().open(null));

    expect(screen.getByTestId(TESTIDS.roomReviewShareButton)).toBeDisabled();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '保存／分享图片' })).toBeEnabled(),
    );
    expect(mockCapture).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('button', { name: '保存／分享图片' }));
    await waitFor(() =>
      expect(mockShare).toHaveBeenCalledWith(
        [{ base64: 'png', filename: 'demo-1234-1.png' }],
        '房间 1234 战报',
      ),
    );
    expect(mockCapture).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith('图片已保存'));
  });

  it('offers every page or only the current one on a multi-page document', async () => {
    mockCapture.mockResolvedValueOnce('png-1').mockResolvedValueOnce('png-2');
    mockShare.mockResolvedValue('handedOff');
    render(<Harness state={available(twoPageDocument())} />);
    act(() => current().open('album-2'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: '保存／分享全部 2 页' })).toBeEnabled(),
    );

    fireEvent.click(screen.getByRole('button', { name: '仅分享本页' }));
    await waitFor(() =>
      expect(mockShare).toHaveBeenCalledWith(
        [{ base64: 'png-2', filename: 'demo-1234-1-p2.png' }],
        '房间 1234 战报',
      ),
    );
  });

  it('blocks the export with the page to retry when a drawing failed', async () => {
    const document = twoPageDocument({
      pages: [
        page('album-1', '第 1 篇', [{ kind: 'divider' }]),
        page('album-2', '第 2 篇', [
          imageBlock('a2', async () => Promise.reject(new Error('500'))),
        ]),
      ],
    });
    render(<Harness state={available(document)} />);
    act(() => current().open('album-2'));

    await waitFor(() =>
      expect(screen.getByText('第 2 页有图片加载失败，点击图片重试后再分享')).toBeTruthy(),
    );
    expect(screen.getByTestId(TESTIDS.roomReviewShareButton)).toBeDisabled();
    const dialog = screen.getByTestId(TESTIDS.roomReviewDialog);
    expect(within(dialog).getByText('加载失败 · 点击重试')).toBeTruthy();
  });

  it('exports without the dialog for a host closing flow, showing progress until hand-off', async () => {
    mockCapture.mockResolvedValue('png');
    mockShare.mockResolvedValue('handedOff');
    render(<Harness state={available(reviewDocument())} />);

    let run: Promise<void> = Promise.resolve();
    act(() => {
      run = current().shareAll();
    });
    expect(screen.getByTestId(TESTIDS.roomReviewProgress)).toBeTruthy();
    expect(screen.getByText('正在准备…')).toBeTruthy();
    await act(async () => {
      await run;
    });
    expect(mockShare).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId(TESTIDS.roomReviewProgress)).toBeNull();
  });
});
