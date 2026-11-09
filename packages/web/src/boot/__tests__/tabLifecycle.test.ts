import { installStaleTabReload } from '../tabLifecycle';

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: state });
  document.dispatchEvent(new Event('visibilitychange'));
}

describe('installStaleTabReload', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('reloads a tab back after five minutes and stops later resume listeners first', () => {
    vi.useFakeTimers();
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    installStaleTabReload();
    const laterListener = vi.fn();
    document.addEventListener('visibilitychange', laterListener);

    setVisibility('hidden');
    laterListener.mockClear();
    vi.advanceTimersByTime(5 * 60 * 1000 + 1);
    setVisibility('visible');

    expect(reload).toHaveBeenCalledTimes(1);
    expect(laterListener).not.toHaveBeenCalled();
    document.removeEventListener('visibilitychange', laterListener);
  });
});
