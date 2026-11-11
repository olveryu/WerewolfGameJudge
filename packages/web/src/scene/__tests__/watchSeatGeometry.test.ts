import { watchSeatGeometry } from '@/scene/watchSeatGeometry';

/** jsdom lays nothing out: mark `element` as rendered. */
function markLaidOut(element: HTMLElement) {
  Object.defineProperty(element, 'offsetParent', { value: document.body, configurable: true });
}

/** A page whose scene host lies beside the scroller, as on the appearance page. */
function mountPage() {
  const body = document.createElement('div');
  const host = document.createElement('div');
  const scroller = document.createElement('div');
  const tile = document.createElement('span');
  scroller.append(tile);
  body.append(host, scroller);
  document.body.append(body);
  markLaidOut(host);
  markLaidOut(tile);
  return { body, host, scroller, tile };
}

describe('watchSeatGeometry', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        observe() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it('re-aligns when a scroller beside the host scrolls', () => {
    const { host, scroller, tile } = mountPage();
    const align = vi.fn();
    const stop = watchSeatGeometry([tile], host, align);

    scroller.dispatchEvent(new Event('scroll'));
    expect(align).toHaveBeenCalledTimes(1);

    stop();
    scroller.dispatchEvent(new Event('scroll'));
    expect(align).toHaveBeenCalledTimes(1);
  });

  it('re-aligns when content inserted above the tile moves it', async () => {
    const { host, scroller, tile } = mountPage();
    const align = vi.fn();
    const stop = watchSeatGeometry([tile], host, align);

    scroller.prepend(document.createElement('p'));
    await Promise.resolve();
    expect(align).toHaveBeenCalledTimes(1);

    stop();
  });

  it('skips a tile that has left the document', async () => {
    const { body, host, scroller, tile } = mountPage();
    const align = vi.fn();
    const stop = watchSeatGeometry([tile], host, align);

    tile.remove();
    await Promise.resolve();
    body.dispatchEvent(new Event('scroll'));
    scroller.dispatchEvent(new Event('scroll'));
    expect(align).not.toHaveBeenCalled();

    stop();
  });
});
