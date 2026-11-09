/**
 * ReviewDocumentView: one renderer for every game's review page. Pins the
 * page chrome per mode, every block kind of the closed vocabulary, tone
 * colors, sentence flow, and the image block's states and export gate.
 */

import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';

import { ReviewDocumentView } from '../components/ReviewDocumentView';
import {
  createReviewAssetStore,
  ReviewAssetStoreContext,
  type ReviewExportGate,
  ReviewExportGateContext,
} from '../reviewAssetStore';
import type { ReviewImageLoadResult, RoomReviewDocument } from '../types';
import { imageBlock, page, reviewDocument, twoPageDocument } from './reviewFixtures';

const SHARE_TITLE = '房间 1234 战报';

/** Matches the element whose whole text content is `text` (prose split across toned spans). */
function textContent(className: string, text: string) {
  return (_: string, element: Element | null) =>
    element !== null && element.classList.contains(className) && element.textContent === text;
}

function renderPage(
  document: RoomReviewDocument,
  options: {
    readonly pageIndex?: number;
    readonly mode?: 'screen' | 'export';
    readonly gate?: ReviewExportGate | null;
  } = {},
) {
  const store = createReviewAssetStore();
  const pageIndex = options.pageIndex ?? 0;
  const view = render(
    <ReviewAssetStoreContext.Provider value={store}>
      <ReviewExportGateContext.Provider value={options.gate ?? null}>
        {options.mode === 'export' ? (
          <ReviewDocumentView
            document={document}
            pageIndex={pageIndex}
            mode="export"
            shareTitle={SHARE_TITLE}
          />
        ) : (
          <ReviewDocumentView document={document} pageIndex={pageIndex} mode="screen" />
        )}
      </ReviewExportGateContext.Provider>
    </ReviewAssetStoreContext.Provider>,
  );
  return { ...view, store };
}

describe('ReviewDocumentView page chrome', () => {
  it('prints the kicker and footer on screen, without the image-only share title', () => {
    renderPage(reviewDocument());
    expect(screen.getByText('🌙 第一夜 · 夜报')).toBeTruthy();
    expect(screen.getByText('本局复盘由对局记录自动生成')).toBeTruthy();
    expect(screen.queryByText(SHARE_TITLE)).toBeNull();
    expect(screen.queryByText('未完成')).toBeNull();
  });

  it('adds the share title in export mode', () => {
    renderPage(reviewDocument(), { mode: 'export' });
    expect(screen.getByText(SHARE_TITLE)).toBeTruthy();
  });

  it('labels a page of a multi-page document with its position only on the image', () => {
    const exported = renderPage(twoPageDocument(), { pageIndex: 1, mode: 'export' });
    expect(screen.getByText('第 2 篇 · 小红的画册 · 2/2')).toBeTruthy();
    expect(screen.getByText('起手词：梨')).toBeTruthy();
    exported.unmount();

    renderPage(twoPageDocument(), { pageIndex: 1, mode: 'screen' });
    expect(screen.queryByText('第 2 篇 · 小红的画册 · 2/2')).toBeNull();
  });

  it('stamps an aborted round 未完成 on every surface', () => {
    renderPage(reviewDocument({ isAborted: true }));
    expect(screen.getByText('未完成')).toBeTruthy();
  });

  it('fails fast on a page the document does not have', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderPage(reviewDocument(), { pageIndex: 3 })).toThrow(
      '[FAIL-FAST] Review demo-1234-1 has no page 3',
    );
  });
});

describe('ReviewDocumentView blocks', () => {
  beforeEach(() => {
    renderPage(reviewDocument());
  });

  it('renders the hero headline with its figure, stamps and byline', () => {
    expect(screen.getByText(textContent('review-headline', '昨夜 2 人出局'))).toBeTruthy();
    const figure = screen
      .getAllByText('2')
      .find((node) => node.classList.contains('review-figure'));
    expect(figure).toHaveAttribute('data-tone', 'out');
    // The stamp and the roster both name the eliminated seer.
    expect(screen.getAllByText('预言家')).toHaveLength(2);
    expect(screen.getAllByText('狼杀出局').length).toBeGreaterThan(0);
    expect(screen.getByText('狼队 3 票锁定')).toBeTruthy();
    expect(screen.getByText('刺客指认出了梅林')).toBeTruthy();
  });

  it('flows consecutive text runs as one sentence with toned words', () => {
    expect(screen.getByText(textContent('review-sentence', '1号狼人袭击3号。'))).toBeTruthy();
    expect(screen.getByText('袭击3号')).toHaveAttribute('data-tone', 'evil');
  });

  it('renders timeline titles, seat medals and tags between text runs', () => {
    expect(screen.getByText('首轮投票结果')).toBeTruthy();
    expect(screen.getByText('4 票：')).toBeTruthy();
    expect(screen.getAllByLabelText('3号').length).toBeGreaterThan(0);
    expect(screen.getByText('当选')).toBeTruthy();
  });

  it('renders stats, sections, groups, roster, facts, scoreboard and paragraphs', () => {
    for (const text of [
      '成功',
      '3',
      '失败',
      '第一夜',
      '全员身份',
      '第 1 次任务',
      '否决',
      '队长 1 号',
    ]) {
      expect(screen.getAllByText(text).length).toBeGreaterThan(0);
    }
    expect(screen.getByText('狼人')).toBeTruthy();
    expect(screen.getByText('存活')).toBeTruthy();
    expect(screen.getByText('平民词')).toBeTruthy();
    expect(screen.getByText('苹果')).toBeTruthy();
    expect(screen.getByText('小明')).toBeTruthy();
    expect(screen.getAllByText('12 分')).toHaveLength(2);
    expect(screen.getByText('机器人')).toBeTruthy();
    expect(screen.getByText('从前有座山。')).toBeTruthy();
    expect(screen.getByText('这一棒交了空白')).toHaveAttribute('data-missing', 'true');
  });

  it('strikes through an eliminated seat in the roster', () => {
    const outRole = screen.getAllByText('预言家').at(-1);
    expect(outRole?.closest('.review-roster-row')).toHaveAttribute('data-out', 'true');
  });
});

describe('ReviewDocumentView image block', () => {
  function imageDocument(load: (signal: AbortSignal) => Promise<ReviewImageLoadResult>) {
    return reviewDocument({ pages: [page('only', null, [imageBlock('a1', load)])] });
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

  it('loads once, shows the drawing and reports ready to the export gate on decode', async () => {
    const report = vi.fn();
    const load = vi.fn(async () => ({
      kind: 'loaded' as const,
      dataUri: 'data:image/png;base64,AA',
    }));
    renderPage(imageDocument(load), { mode: 'export', gate: { report } });

    const image = await screen.findByRole('img', { name: '画作 a1' });
    expect(image).toHaveAttribute('src', 'data:image/png;base64,AA');
    expect(report).not.toHaveBeenCalled();
    fireEvent.load(image);
    expect(report).toHaveBeenCalledWith('only/0', 'ready');
    expect(load).toHaveBeenCalledTimes(1);
    expect(screen.getByText('画作 a1')).toBeTruthy();
  });

  it('shows an unavailable drawing honestly and never blocks the export', async () => {
    const report = vi.fn();
    renderPage(
      imageDocument(async () => ({ kind: 'unavailable', message: '画作已过期' })),
      {
        mode: 'export',
        gate: { report },
      },
    );
    expect(await screen.findByText('画作已过期')).toBeTruthy();
    expect(report).toHaveBeenCalledWith('only/0', 'ready');
  });

  it('blocks the export on a failed load and retries on press', async () => {
    const report = vi.fn();
    const attempts = [deferred<ReviewImageLoadResult>(), deferred<ReviewImageLoadResult>()];
    let call = 0;
    const load = vi.fn(() => {
      const attempt = attempts[call];
      call += 1;
      if (attempt === undefined) throw new Error('unexpected extra load');
      return attempt.promise;
    });
    renderPage(imageDocument(load), { mode: 'export', gate: { report } });

    await act(async () => {
      attempts[0]?.reject(new Error('network'));
    });
    expect(await screen.findByText('加载失败 · 点击重试')).toBeTruthy();
    expect(report).toHaveBeenCalledWith('only/0', 'failed');

    fireEvent.click(screen.getByRole('button', { name: '画作 a1加载失败，点击重试' }));
    await act(async () => {
      attempts[1]?.resolve({ kind: 'loaded', dataUri: 'data:image/png;base64,BB' });
    });
    await waitFor(() =>
      expect(screen.getByRole('img', { name: '画作 a1' })).toHaveAttribute(
        'src',
        'data:image/png;base64,BB',
      ),
    );
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('turns a drawing that fails to decode into a retryable failure', async () => {
    const report = vi.fn();
    renderPage(
      imageDocument(async () => ({ kind: 'loaded', dataUri: 'data:image/png;base64,broken' })),
      { mode: 'export', gate: { report } },
    );
    fireEvent.error(await screen.findByRole('img', { name: '画作 a1' }));
    expect(await screen.findByText('加载失败 · 点击重试')).toBeTruthy();
    expect(report).toHaveBeenCalledWith('only/0', 'failed');
  });

  it('renders on screen without a gate', async () => {
    renderPage(
      imageDocument(async () => ({ kind: 'loaded', dataUri: 'data:image/png;base64,CC' })),
    );
    fireEvent.load(await screen.findByRole('img', { name: '画作 a1' }));
    expect(screen.getByText('画作 a1')).toBeTruthy();
  });

  it('fails fast outside a review asset scope', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() =>
      render(
        <ReviewDocumentView
          document={imageDocument(async () => ({ kind: 'unavailable', message: 'x' }))}
          pageIndex={0}
          mode="screen"
        />,
      ),
    ).toThrow('[FAIL-FAST] Review images render only inside a review asset scope');
  });
});
