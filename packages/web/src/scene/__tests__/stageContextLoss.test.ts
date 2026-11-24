import { Container } from 'pixi.js';

/** A recorded stand-in for one PixiJS `Application` the stage drives. */
interface FakeApp {
  readonly stage: Container;
  readonly canvas: HTMLCanvasElement;
  readonly render: ReturnType<typeof vi.fn>;
  readonly resize: ReturnType<typeof vi.fn>;
  readonly destroy: ReturnType<typeof vi.fn>;
  readonly ticker: {
    started: boolean;
    lastTime: number;
    maxFPS: number;
    readonly callbacks: Set<() => void>;
    readonly start: ReturnType<typeof vi.fn>;
    readonly stop: ReturnType<typeof vi.fn>;
  };
}

const pixiFake = vi.hoisted(() => ({
  apps: [] as FakeApp[],
  /** When set, the next `init` rejects with it (WebGL unavailable). */
  initError: null as Error | null,
  resizeCallbacks: [] as Array<() => void>,
}));

vi.mock('pixi.js/browser', () => ({}));
vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>();
  class FakeApplication implements FakeApp {
    readonly stage = new pixi.Container();
    readonly canvas = document.createElement('canvas');
    readonly renderer = { resolution: 1 };
    readonly render = vi.fn();
    readonly resize = vi.fn();
    readonly destroy = vi.fn(() => {
      this.canvas.remove();
    });
    readonly ticker: FakeApp['ticker'] = {
      started: false,
      lastTime: 0,
      maxFPS: 0,
      callbacks: new Set(),
      start: vi.fn(() => {
        this.ticker.started = true;
      }),
      stop: vi.fn(() => {
        this.ticker.started = false;
      }),
    };
    resizeTo: HTMLElement | null = null;
    constructor() {
      const { ticker } = this;
      Object.assign(ticker, {
        add: (callback: () => void) => ticker.callbacks.add(callback),
        remove: (callback: () => void) => ticker.callbacks.delete(callback),
      });
    }
    async init(): Promise<void> {
      const error = pixiFake.initError;
      pixiFake.initError = null;
      if (error) throw error;
      pixiFake.apps.push(this);
    }
  }
  return { ...pixi, Application: FakeApplication };
});

function contextEvent(type: 'webglcontextlost' | 'webglcontextrestored'): Event {
  return new Event(type, { cancelable: true });
}

/** The application the stage currently draws with. */
function current(): FakeApp {
  const app = pixiFake.apps.at(-1);
  if (!app) throw new Error('stage application not created');
  return app;
}

async function mountedStage() {
  const { sharedSceneStage } = await import('@/scene/stage');
  const stage = await sharedSceneStage();
  const host = document.createElement('div');
  document.body.append(host);
  const root = new Container();
  const release = stage.mountOverlay(host, root, () => {});
  return { stage, host, root, release };
}

/** Lets the rebuild's awaited `init` settle. */
async function flush(): Promise<void> {
  await vi.advanceTimersByTimeAsync(0);
}

describe('scene stage WebGL context loss', () => {
  beforeAll(() => {
    vi.stubGlobal(
      'ResizeObserver',
      class {
        private readonly callback: () => void;
        constructor(callback: () => void) {
          this.callback = callback;
        }
        observe() {
          pixiFake.resizeCallbacks.push(this.callback);
        }
        disconnect() {
          pixiFake.resizeCallbacks = pixiFake.resizeCallbacks.filter((c) => c !== this.callback);
        }
      },
    );
    // jsdom has no 2D canvas: the dot texture only needs the drawing calls to exist.
    const context = { fillStyle: '', beginPath() {}, arc() {}, fill() {} };
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value: () => context,
    });
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    for (const app of pixiFake.apps) {
      app.render.mockClear();
      app.ticker.start.mockClear();
      app.ticker.stop.mockClear();
    }
  });

  it('pauses while lost and resumes the animation on restore', async () => {
    const { release } = await mountedStage();
    const app = current();
    expect(app.ticker.started).toBe(true);

    expect(() => app.canvas.dispatchEvent(contextEvent('webglcontextlost'))).not.toThrow();
    expect(app.ticker.started).toBe(false);
    expect(app.render).not.toHaveBeenCalled();

    app.canvas.dispatchEvent(contextEvent('webglcontextrestored'));
    expect(app.ticker.started).toBe(true);
    release();
  });

  it('redraws a still frame once the context is restored', async () => {
    const { stage, root, release } = await mountedStage();
    const app = current();
    stage.setOverlayAnimating(root, false);
    app.render.mockClear();

    app.canvas.dispatchEvent(contextEvent('webglcontextlost'));
    expect(app.render).not.toHaveBeenCalled();
    app.canvas.dispatchEvent(contextEvent('webglcontextrestored'));
    expect(app.ticker.started).toBe(false);
    expect(app.render).toHaveBeenCalledTimes(1);
    release();
  });

  it('draws nothing when an overlay pauses while the context is lost, and redraws on restore', async () => {
    const { stage, root, release } = await mountedStage();
    const app = current();
    expect(app.ticker.started).toBe(true);

    app.canvas.dispatchEvent(contextEvent('webglcontextlost'));
    app.render.mockClear();
    stage.setOverlayAnimating(root, false);
    expect(app.render).not.toHaveBeenCalled();

    app.canvas.dispatchEvent(contextEvent('webglcontextrestored'));
    expect(app.ticker.started).toBe(false);
    expect(app.render).toHaveBeenCalledTimes(1);
    release();
  });

  it('draws nothing on resize while the context is lost, and redraws on restore and later resizes', async () => {
    const { stage, root, release } = await mountedStage();
    const app = current();
    stage.setOverlayAnimating(root, false);
    const fireResize = () => {
      for (const callback of pixiFake.resizeCallbacks) callback();
    };
    expect(pixiFake.resizeCallbacks.length).toBeGreaterThan(0);

    app.canvas.dispatchEvent(contextEvent('webglcontextlost'));
    app.render.mockClear();
    fireResize();
    expect(app.resize).toHaveBeenCalled();
    expect(app.render).not.toHaveBeenCalled();

    app.canvas.dispatchEvent(contextEvent('webglcontextrestored'));
    expect(app.render).toHaveBeenCalledTimes(1);
    fireResize();
    expect(app.render).toHaveBeenCalledTimes(2);
    release();
  });

  it('does not rebuild when the context is restored before the deadline', async () => {
    const { CONTEXT_RESTORE_DEADLINE_MS } = await import('@/scene/stage');
    const { release } = await mountedStage();
    const app = current();
    const appCount = pixiFake.apps.length;

    app.canvas.dispatchEvent(contextEvent('webglcontextlost'));
    await vi.advanceTimersByTimeAsync(CONTEXT_RESTORE_DEADLINE_MS - 1);
    app.canvas.dispatchEvent(contextEvent('webglcontextrestored'));
    await vi.advanceTimersByTimeAsync(CONTEXT_RESTORE_DEADLINE_MS);

    expect(pixiFake.apps).toHaveLength(appCount);
    expect(app.destroy).not.toHaveBeenCalled();
    expect(app.ticker.started).toBe(true);
    release();
  });

  it('rebuilds on a new canvas when the context is never restored, moving the whole scene over', async () => {
    const { CONTEXT_RESTORE_DEADLINE_MS } = await import('@/scene/stage');
    const { stage, host, root, release } = await mountedStage();
    stage.setFrameRate(30);
    const lost = current();
    const world = root.parent;
    expect(world).not.toBeNull();
    expect(host.contains(lost.canvas)).toBe(true);

    lost.canvas.dispatchEvent(contextEvent('webglcontextlost'));
    await vi.advanceTimersByTimeAsync(CONTEXT_RESTORE_DEADLINE_MS);
    await flush();

    const next = current();
    expect(next).not.toBe(lost);
    // The old renderer goes, the stage's world (seats and the overlay) does not.
    expect(lost.destroy).toHaveBeenCalledWith({ removeView: true }, { children: false });
    expect(lost.ticker.callbacks.size).toBe(0);
    expect(root.parent).toBe(world);
    expect(world?.parent).toBe(next.stage);
    expect(world?.destroyed).toBe(false);
    // Drawn again where the old canvas was, at the same frame cap.
    expect(host.contains(next.canvas)).toBe(true);
    expect(host.contains(lost.canvas)).toBe(false);
    expect(next.ticker.maxFPS).toBe(30);
    expect(next.ticker.callbacks.size).toBe(1);
    expect(next.ticker.started).toBe(true);

    // A late restore on the abandoned canvas is not observed; the new canvas is.
    next.ticker.start.mockClear();
    lost.canvas.dispatchEvent(contextEvent('webglcontextrestored'));
    await vi.advanceTimersByTimeAsync(CONTEXT_RESTORE_DEADLINE_MS);
    expect(current()).toBe(next);
    expect(next.ticker.start).not.toHaveBeenCalled();
    next.canvas.dispatchEvent(contextEvent('webglcontextlost'));
    expect(next.ticker.started).toBe(false);
    next.canvas.dispatchEvent(contextEvent('webglcontextrestored'));
    expect(next.ticker.started).toBe(true);
    release();
  });

  it('redraws a still scene once after rebuilding', async () => {
    const { CONTEXT_RESTORE_DEADLINE_MS } = await import('@/scene/stage');
    const { stage, root, release } = await mountedStage();
    stage.setOverlayAnimating(root, false);
    const lost = current();

    lost.canvas.dispatchEvent(contextEvent('webglcontextlost'));
    await vi.advanceTimersByTimeAsync(CONTEXT_RESTORE_DEADLINE_MS);
    await flush();

    const next = current();
    expect(next).not.toBe(lost);
    expect(next.ticker.started).toBe(false);
    expect(next.render).toHaveBeenCalledTimes(1);
    release();
  });

  it('counts lost time only while the page is visible', async () => {
    const { CONTEXT_RESTORE_DEADLINE_MS } = await import('@/scene/stage');
    const { release } = await mountedStage();
    const app = current();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);

    app.canvas.dispatchEvent(contextEvent('webglcontextlost'));
    await vi.advanceTimersByTimeAsync(CONTEXT_RESTORE_DEADLINE_MS * 3);
    expect(current()).toBe(app);

    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(CONTEXT_RESTORE_DEADLINE_MS - 1);
    expect(current()).toBe(app);
    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(current()).not.toBe(app);
    hidden.mockRestore();
    release();
  });

  it('keeps the scene paused when no new WebGL context can be created', async () => {
    const { CONTEXT_RESTORE_DEADLINE_MS } = await import('@/scene/stage');
    const { release } = await mountedStage();
    const lost = current();
    pixiFake.initError = new Error('WebGL unavailable');

    lost.canvas.dispatchEvent(contextEvent('webglcontextlost'));
    await vi.advanceTimersByTimeAsync(CONTEXT_RESTORE_DEADLINE_MS);
    await flush();

    expect(current()).toBe(lost);
    expect(lost.destroy).not.toHaveBeenCalled();
    expect(lost.ticker.started).toBe(false);
    release();
  });
});
