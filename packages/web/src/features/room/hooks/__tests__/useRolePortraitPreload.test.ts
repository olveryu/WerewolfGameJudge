import { renderHook, waitFor } from '@testing-library/react';
import { createElement, type ReactNode, StrictMode } from 'react';

import { handleError } from '@/utils/errorPipeline';
import { roomScreenLog } from '@/utils/logger';

import { useRolePortraitPreload } from '../useRolePortraitPreload';

vi.mock('@/utils/errorPipeline', () => ({ handleError: vi.fn() }));

describe('useRolePortraitPreload', () => {
  const images: HTMLImageElement[] = [];

  beforeEach(() => {
    images.length = 0;
    vi.clearAllMocks();
    vi.spyOn(HTMLImageElement.prototype, 'decode').mockImplementation(function (
      this: HTMLImageElement,
    ) {
      images.push(this);
      return Promise.resolve();
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mount(urls: readonly string[]) {
    return renderHook(({ urls }) => useRolePortraitPreload(urls), {
      initialProps: { urls },
    });
  }

  it('fetches and decodes each candidate at low priority before any card opens', () => {
    mount(['/wolf.webp', '/seer.webp', '/wolf.webp']);
    expect(images.map((image) => image.getAttribute('src'))).toEqual(['/wolf.webp', '/seer.webp']);
    expect(images.every((image) => image.fetchPriority === 'low')).toBe(true);
  });

  it('deduplicates snapshot updates and fetches new candidates when the public board changes', () => {
    const { rerender } = mount(['/wolf.webp', '/seer.webp']);
    rerender({ urls: ['/seer.webp', '/wolf.webp'] });
    expect(images).toHaveLength(2);
    rerender({ urls: ['/wolf.webp', '/witch.webp'] });
    expect(images.map((image) => image.getAttribute('src'))).toEqual([
      '/wolf.webp',
      '/seer.webp',
      '/witch.webp',
    ]);
  });

  it('does not request anything when the game has no portrait candidates', () => {
    mount([]);
    expect(images).toHaveLength(0);
  });

  it('does not repeat requests when StrictMode replays the effect', () => {
    renderHook(() => useRolePortraitPreload(['/wolf.webp']), {
      wrapper: ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children),
    });
    expect(HTMLImageElement.prototype.decode).toHaveBeenCalledTimes(1);
  });

  it('does not suspend the room while decoding is pending', () => {
    vi.mocked(HTMLImageElement.prototype.decode).mockReturnValue(new Promise(() => {}));
    const { result } = renderHook(() => {
      useRolePortraitPreload(['/wolf.webp']);
      return 'room ready';
    });
    expect(result.current).toBe('room ready');
  });

  it('logs a failed preload without blocking the room or retrying every snapshot', async () => {
    const error = new Error('portrait decode failed');
    vi.mocked(HTMLImageElement.prototype.decode).mockRejectedValue(error);
    const { rerender } = mount(['/wolf.webp']);
    await waitFor(() => {
      expect(handleError).toHaveBeenCalledWith(error, {
        label: '预加载角色立绘',
        logger: roomScreenLog,
        feedback: false,
      });
    });
    rerender({ urls: ['/wolf.webp'] });
    expect(HTMLImageElement.prototype.decode).toHaveBeenCalledTimes(1);
  });

  it('continues preparing other candidates if one fails', async () => {
    vi.mocked(HTMLImageElement.prototype.decode).mockRejectedValueOnce(new Error('offline'));
    mount(['/wolf.webp', '/seer.webp']);
    await waitFor(() => expect(handleError).toHaveBeenCalledTimes(1));
    expect(HTMLImageElement.prototype.decode).toHaveBeenCalledTimes(2);
    expect(images[0]?.getAttribute('src')).toBe('/seer.webp');
  });

  it('retries in a new room mount after a failed preload', async () => {
    vi.mocked(HTMLImageElement.prototype.decode).mockRejectedValueOnce(new Error('offline'));
    const first = mount(['/wolf.webp']);
    await waitFor(() => expect(handleError).toHaveBeenCalledTimes(1));
    first.unmount();
    mount(['/wolf.webp']);
    expect(HTMLImageElement.prototype.decode).toHaveBeenCalledTimes(2);
  });
});
