/**
 * useRoomReviewExport: the one export flow. Capture runs only on the
 * hidden stage, once per page and scope; a share run reports honest
 * phases; cancelling detaches the UI only; outcomes and failures give the
 * documented feedback.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import { toast } from 'sonner-native';

import { captureViewPngBase64 } from '@/features/room/services/captureViewPngBase64';
import { captureViewSegmentedPngBase64 } from '@/features/room/services/captureViewSegmentedPngBase64';
import {
  previewUploadedImages,
  shareImagesBase64,
  uploadShareImages,
} from '@/features/room/services/shareImage';
import { TESTIDS } from '@/testids';
import { handleError } from '@/utils/errorPipeline';
import { isMiniProgram } from '@/utils/miniProgram';

import { RoomReviewExportStage } from '../components/RoomReviewExportStage';
import { createReviewAssetStore, ReviewAssetStoreContext } from '../reviewAssetStore';
import type { RoomReviewDocument } from '../types';
import { type RoomReviewExport, useRoomReviewExport } from '../useRoomReviewExport';
import { imageBlock, page, reviewDocument, twoPageDocument } from './reviewFixtures';

jest.mock('@/features/room/services/captureViewPngBase64', () => ({
  captureViewPngBase64: jest.fn(),
}));
jest.mock('@/features/room/services/captureViewSegmentedPngBase64', () => ({
  ...jest.requireActual<typeof import('@/features/room/services/captureViewSegmentedPngBase64')>(
    '@/features/room/services/captureViewSegmentedPngBase64',
  ),
  captureViewSegmentedPngBase64: jest.fn(),
}));
jest.mock('@/features/room/services/shareImage', () => ({
  shareImagesBase64: jest.fn(),
  uploadShareImages: jest.fn(),
  previewUploadedImages: jest.fn(),
}));
jest.mock('@/utils/miniProgram', () => ({ isMiniProgram: jest.fn(() => false) }));
jest.mock('@/utils/errorPipeline', () => ({ handleError: jest.fn() }));

const mockCapture = jest.mocked(captureViewPngBase64);
const mockSegmentedCapture = jest.mocked(captureViewSegmentedPngBase64);
const mockShare = jest.mocked(shareImagesBase64);
const mockUpload = jest.mocked(uploadShareImages);
const mockPreview = jest.mocked(previewUploadedImages);
const mockIsMiniProgram = jest.mocked(isMiniProgram);
const mockHandleError = jest.mocked(handleError);

let latest: RoomReviewExport | null = null;

function current(): RoomReviewExport {
  if (latest === null) throw new Error('harness not rendered');
  return latest;
}

function capture(exporter: RoomReviewExport) {
  latest = exporter;
}

function Harness({
  document,
  onRender = capture,
}: {
  readonly document: RoomReviewDocument | null;
  readonly onRender?: (exporter: RoomReviewExport) => void;
}) {
  const exporter = useRoomReviewExport({
    roomId: 'room-1',
    userId: 'user-1',
    shareTitle: '房间 1234 战报',
    document,
  });
  onRender(exporter);
  const [store] = useState(createReviewAssetStore);
  return (
    <ReviewAssetStoreContext.Provider value={store}>
      {exporter.stageRequest !== null && (
        <RoomReviewExportStage
          key={exporter.stageRequest.id}
          request={exporter.stageRequest}
          width={exporter.pageWidth}
        />
      )}
    </ReviewAssetStoreContext.Provider>
  );
}

/** The stage is hidden from assistive technology by design; tests reach into it explicitly. */
const HIDDEN = { includeHiddenElements: true } as const;

async function layOut(heights: Readonly<Record<string, number>>) {
  for (const [pageKey, height] of Object.entries(heights)) {
    const node = await screen.findByTestId(TESTIDS.roomReviewStagePage(pageKey), HIDDEN);
    fireEvent(node, 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: 440, height } } });
  }
}

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  let reject: (error: Error) => void = () => undefined;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function startShare(pageIndexes: readonly number[]): Promise<void> {
  let run: Promise<void> = Promise.resolve();
  act(() => {
    run = current().share(pageIndexes);
  });
  return run;
}

beforeEach(() => {
  jest.clearAllMocks();
  latest = null;
  mockIsMiniProgram.mockReturnValue(false);
});

describe('useRoomReviewExport share runs', () => {
  it('captures each page once on the stage, hands them off in order and confirms a download', async () => {
    mockCapture.mockResolvedValueOnce('png-1').mockResolvedValueOnce('png-2');
    mockShare.mockResolvedValue('downloaded');
    render(<Harness document={twoPageDocument()} />);

    const run = startShare([0, 1]);
    expect(current().run).toEqual({ phase: 'preparing' });
    expect(current().isSharing).toBe(true);
    await layOut({ 'album-1': 600, 'album-2': 700 });
    await act(async () => {
      await run;
    });

    expect(mockCapture).toHaveBeenCalledTimes(2);
    expect(mockShare).toHaveBeenCalledWith(
      [
        { base64: 'png-1', filename: 'demo-1234-1-p1.png' },
        { base64: 'png-2', filename: 'demo-1234-1-p2.png' },
      ],
      '房间 1234 战报',
    );
    expect(toast.success).toHaveBeenCalledWith('图片已保存');
    expect(current().run).toBeNull();
    expect(current().isSharing).toBe(false);
    expect(screen.queryByTestId(TESTIDS.roomReviewStagePage('album-1'), HIDDEN)).toBeNull();
  });

  it('reuses captured pages: sharing one page again captures nothing', async () => {
    mockCapture.mockResolvedValueOnce('png-1').mockResolvedValueOnce('png-2');
    mockShare.mockResolvedValue('handedOff');
    render(<Harness document={twoPageDocument()} />);
    const first = startShare([0, 1]);
    await layOut({ 'album-1': 600, 'album-2': 700 });
    await act(async () => {
      await first;
    });

    await act(async () => {
      await current().share([1]);
    });
    expect(mockCapture).toHaveBeenCalledTimes(2);
    expect(mockShare).toHaveBeenLastCalledWith(
      [{ base64: 'png-2', filename: 'demo-1234-1-p2.png' }],
      '房间 1234 战报',
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it('starts a new cache scope when the document content changes', async () => {
    mockCapture.mockResolvedValue('png');
    mockShare.mockResolvedValue('handedOff');
    const view = render(<Harness document={reviewDocument()} />);
    const first = startShare([0]);
    await layOut({ only: 800 });
    await act(async () => {
      await first;
    });

    view.rerender(<Harness document={reviewDocument({ footer: '新的页脚' })} />);
    const second = startShare([0]);
    await layOut({ only: 800 });
    await act(async () => {
      await second;
    });
    expect(mockCapture).toHaveBeenCalledTimes(2);
  });

  it('fails fast on a second run while one is active', async () => {
    mockCapture.mockResolvedValue('png');
    mockShare.mockResolvedValue('handedOff');
    render(<Harness document={reviewDocument()} />);
    const run = startShare([0]);
    await expect(current().share([0])).rejects.toThrow(
      '[FAIL-FAST] A review share is already running',
    );
    await layOut({ only: 800 });
    await act(async () => {
      await run;
    });
  });

  it('fails fast without a document this viewer may share', () => {
    render(<Harness document={null} />);
    expect(() => current().readiness([0])).toThrow(
      '[FAIL-FAST] Review export used without a document this viewer may share',
    );
  });
});

describe('useRoomReviewExport mini program', () => {
  it('captures band by band, uploads, then opens the preview album', async () => {
    mockIsMiniProgram.mockReturnValue(true);
    const capture = deferred<string>();
    mockSegmentedCapture.mockImplementation(async (_ref, options) => {
      options?.onProgress?.(0, 2);
      options?.onProgress?.(1, 2);
      return capture.promise;
    });
    const upload = deferred<string[]>();
    mockUpload.mockReturnValue(upload.promise);
    mockPreview.mockResolvedValue('previewed');
    render(<Harness document={reviewDocument()} />);

    const run = startShare([0]);
    await layOut({ only: 1500 });
    await waitFor(() => expect(current().run).toEqual({ phase: 'capturing', done: 1, total: 2 }));

    await act(async () => {
      capture.resolve('png-seg');
    });
    await waitFor(() => expect(current().run).toEqual({ phase: 'uploading' }));
    expect(mockUpload).toHaveBeenCalledWith([{ base64: 'png-seg', filename: 'demo-1234-1.png' }]);

    await act(async () => {
      upload.resolve(['https://share/1.png']);
      await run;
    });
    expect(mockPreview).toHaveBeenCalledWith(['https://share/1.png']);
    expect(mockShare).not.toHaveBeenCalled();
    expect(current().run).toBeNull();
  });

  it('detaches on cancel during upload: the upload completes, the preview never opens', async () => {
    mockIsMiniProgram.mockReturnValue(true);
    mockSegmentedCapture.mockResolvedValue('png-seg');
    const upload = deferred<string[]>();
    mockUpload.mockReturnValue(upload.promise);
    render(<Harness document={reviewDocument()} />);

    const run = startShare([0]);
    await layOut({ only: 900 });
    await waitFor(() => expect(current().run).toEqual({ phase: 'uploading' }));
    act(() => current().cancel());
    expect(current().run).toBeNull();
    expect(current().isSharing).toBe(false);

    await act(async () => {
      upload.resolve(['https://share/1.png']);
      await run;
    });
    expect(mockPreview).not.toHaveBeenCalled();
    expect(mockHandleError).not.toHaveBeenCalled();
  });
});

describe('useRoomReviewExport background capture', () => {
  it('prepares pages without handing them off and reports readiness', async () => {
    mockCapture.mockResolvedValueOnce('png-1').mockResolvedValueOnce('png-2');
    render(<Harness document={twoPageDocument()} />);
    expect(current().readiness([0, 1])).toEqual({ kind: 'idle' });

    act(() => current().prepare([0, 1]));
    expect(current().readiness([0, 1])).toEqual({ kind: 'capturing', progress: null });
    await layOut({ 'album-1': 600, 'album-2': 700 });

    await waitFor(() => expect(current().readiness([0, 1])).toEqual({ kind: 'ready' }));
    expect(mockShare).not.toHaveBeenCalled();
    expect(current().run).toBeNull();
  });

  it('marks a failed background capture so only a share run retries it', async () => {
    mockCapture.mockRejectedValueOnce(new Error('canvas tainted'));
    render(<Harness document={reviewDocument()} />);
    act(() => current().prepare([0]));
    await layOut({ only: 600 });
    await waitFor(() => expect(current().readiness([0])).toEqual({ kind: 'failed' }));
    expect(mockHandleError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ feedback: false }),
    );

    act(() => current().prepare([0]));
    expect(screen.queryByTestId(TESTIDS.roomReviewStagePage('only'), HIDDEN)).toBeNull();
  });
});

describe('useRoomReviewExport failures', () => {
  it('reports a capture failure as a toast and ends the run', async () => {
    mockCapture.mockRejectedValue(new Error('html2canvas failed'));
    render(<Harness document={reviewDocument()} />);
    const run = startShare([0]);
    await layOut({ only: 600 });
    await act(async () => {
      await run;
    });
    expect(mockHandleError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'html2canvas failed' }),
      expect.objectContaining({ feedback: 'toast', alertMessage: '无法生成战报截图，请重试' }),
    );
    expect(mockShare).not.toHaveBeenCalled();
    expect(current().run).toBeNull();
  });

  it('refuses a page taller than the cap instead of slicing it', async () => {
    render(<Harness document={reviewDocument()} />);
    const run = startShare([0]);
    await layOut({ only: 9000 });
    await act(async () => {
      await run;
    });
    expect(mockCapture).not.toHaveBeenCalled();
    expect(mockHandleError).toHaveBeenCalledWith(
      expect.objectContaining({
        message: '[FAIL-FAST] Review page only is 9000px tall; pages are capped at 8192px',
      }),
      expect.objectContaining({ feedback: 'toast' }),
    );
  });

  it('waits for a failed drawing instead of capturing a hole', async () => {
    const document = reviewDocument({
      pages: [page('only', null, [imageBlock('a1', async () => Promise.reject(new Error('404')))])],
    });
    render(<Harness document={document} />);
    const run = startShare([0]);
    // The failure travels through renders (asset store → image block → stage
    // gate); waitFor flushes React work between polls, a single act would not.
    await waitFor(() => expect(mockHandleError).toHaveBeenCalled());
    await act(async () => {
      await run;
    });
    expect(mockCapture).not.toHaveBeenCalled();
    expect(mockHandleError).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'ReviewImageFailedError' }),
      expect.objectContaining({
        feedback: 'toast',
        alertMessage: '有图片加载失败，请在复盘中点击图片重试',
      }),
    );
  });

  it('reports a failed hand-off as a share failure', async () => {
    mockCapture.mockResolvedValue('png');
    mockShare.mockRejectedValue(new Error('share sheet crashed'));
    render(<Harness document={reviewDocument()} />);
    const run = startShare([0]);
    await layOut({ only: 600 });
    await act(async () => {
      await run;
    });
    expect(mockHandleError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'share sheet crashed' }),
      expect.objectContaining({ label: '分享', alertMessage: '无法分享图片，请稍后重试' }),
    );
    expect(current().isSharing).toBe(false);
  });
});
