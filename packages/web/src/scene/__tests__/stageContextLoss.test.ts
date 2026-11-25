import { Container, hasCachedCanvasTexture } from 'pixi.js';

/** A recorded stand-in for one PixiJS `WebGLRenderer` the stage creates. */
interface FakeRenderer {
  readonly screenKey: number;
  canvas: HTMLCanvasElement;
  readonly scheduler: { readonly destroy: () => void };
  readonly events: { readonly destroy: () => void };
  readonly view: { readonly destroy: () => void };
  readonly accessibility: { readonly destroy: () => void };
  /** The accessibility system's touch-hook button, appended to `document.body` on phones and tablets. */
  touchHook: HTMLButtonElement | null;
  readonly filter: { readonly destroy: () => void };
  /** A system whose `init` runs after the context system's, so a failed `init` never reaches it. */
  readonly limits: { readonly destroy: () => void };
  /** A render pipe whose `destroy` throws without a context, like `GlSmoothGraphicsAdaptor`'s. */
  readonly renderPipes: { readonly smoothGraphics: { readonly destroy: ReturnType<typeof vi.fn> } };
  readonly runners: {
    readonly destroy: { readonly items: readonly object[] };
    readonly contextChange: {
      readonly items: Set<{ contextChange(): void }>;
      add(item: { contextChange(): void }): void;
      remove(item: { contextChange(): void }): void;
    };
  };
  readonly render: ReturnType<typeof vi.fn>;
  readonly resize: ReturnType<typeof vi.fn>;
  readonly destroy: ReturnType<typeof vi.fn>;
}

/** A recorded stand-in for the stage's PixiJS `Ticker`. */
interface FakeTicker {
  started: boolean;
  lastTime: number;
  maxFPS: number;
  readonly callbacks: Set<() => void>;
  readonly start: ReturnType<typeof vi.fn>;
  readonly stop: ReturnType<typeof vi.fn>;
}

interface WebglRequest {
  readonly canvas: HTMLCanvasElement;
  readonly type: 'webgl2' | 'webgl';
  readonly attributes: WebGLContextAttributes | undefined;
}

const pixiFake = vi.hoisted(() => ({
  /** Every renderer constructed, in order, initialised or not. */
  created: [] as FakeRenderer[],
  /** Renderers whose `init` resolved and that are not destroyed. */
  renderers: [] as FakeRenderer[],
  tickers: [] as FakeTicker[],
  /**
   * Module-level PixiJS state that outlives a renderer unless its systems are destroyed: the
   * listeners on the global `Ticker.system` (a scheduler, the events ticker), the renderer whose
   * event system the global `EventsTicker` serves, and the screens registered with the global
   * texture pools. Anything left here keeps a renderer reachable.
   */
  systemTickerListeners: new Set<object>(),
  eventsTickerOwner: null as object | null,
  /** The global events ticker's own listener on `Ticker.system`. */
  eventsTickerListener: {},
  poolScreens: new Set<number>(),
  /** The accessibility systems listening for `keydown` on `globalThis` (`activateOnTab`). */
  windowKeydownListeners: new Set<object>(),
  /** The filter systems listening for the global `TexturePool`'s `evict`. */
  texturePoolEvictListeners: new Set<object>(),
  /**
   * When true, PixiJS's own restore handler throws, as the patched limits check does when the
   * context is lost again while PixiJS resets its GPU state.
   */
  pixiRestoreThrows: false,
  canvas2dUnavailable: false,
  /** How many of the next context creations get no WebGL context at all (either version). */
  contextFailures: 0,
  /** When true, `getContext('webgl2')` returns null, as on a WebGL 1 only device. */
  webgl2Unavailable: false,
  /** When true, new WebGL contexts are created already lost. */
  lostOnCreate: false,
  webglRequests: [] as WebglRequest[],
  /** Canvases whose GPU context was released with `WEBGL_lose_context`. */
  releasedContexts: [] as HTMLCanvasElement[],
  /**
   * How many of the next `init` calls reject after a context was obtained, having done what
   * PixiJS's systems do before that point (see the fake's `init`).
   */
  initFailures: 0,
  initCalls: 0,
  initOptions: [] as Array<Record<string, unknown>>,
  /** When set, `init` waits for it, so a test can act while a rebuild is in flight. */
  initGate: null as Promise<void> | null,
  resizeCallbacks: [] as Array<() => void>,
}));

vi.mock('pixi.js/browser', () => ({}));
vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>();
  let nextScreenKey = 1;
  class FakeWebGLRenderer implements FakeRenderer {
    readonly screenKey = nextScreenKey++;
    canvas = document.createElement('canvas');
    readonly resolution = 1;
    readonly render = vi.fn();
    readonly resize = vi.fn();
    touchHook: HTMLButtonElement | null = null;
    readonly scheduler = {
      destroy: () => {
        pixiFake.systemTickerListeners.delete(this.scheduler);
      },
    };
    readonly events = {
      // EventSystem.destroy → EventsTicker.destroy: the global events ticker lets go.
      destroy: () => {
        pixiFake.eventsTickerOwner = null;
        pixiFake.systemTickerListeners.delete(pixiFake.eventsTickerListener);
      },
    };
    readonly view = {
      destroy: () => {
        if (pixi.hasCachedCanvasTexture(this.canvas)) {
          pixi.getCanvasTexture(this.canvas).destroy(true);
        }
        pixiFake.poolScreens.delete(this.screenKey);
      },
    };
    readonly accessibility = {
      // AccessibilitySystem.destroy also removes the touch hook (`_destroyTouchHook`).
      destroy: () => {
        pixiFake.windowKeydownListeners.delete(this.accessibility);
        this.touchHook?.remove();
        this.touchHook = null;
      },
    };
    readonly filter = {
      destroy: () => {
        pixiFake.texturePoolEvictListeners.delete(this.filter);
      },
    };
    private limitsInitialised = false;
    readonly limits = {
      destroy: () => {
        if (!this.limitsInitialised) throw new TypeError('limits destroyed before its init ran');
      },
    };
    readonly renderPipes = {
      smoothGraphics: {
        destroy: vi.fn(() => {
          throw new TypeError("Cannot read properties of null (reading 'destroy')");
        }),
      },
    };
    // PixiJS adds the systems in attach order, then the pipes, to the `destroy` runner.
    readonly runners = {
      contextChange: {
        items: new Set<{ contextChange(): void }>(),
        add(item: { contextChange(): void }) {
          this.items.add(item);
        },
        remove(item: { contextChange(): void }) {
          this.items.delete(item);
        },
      },
      destroy: {
        items: [
          this.view,
          this.scheduler,
          this.accessibility,
          this.events,
          this.filter,
          this.limits,
          this.renderPipes.smoothGraphics,
        ],
      },
    };
    readonly destroy = vi.fn((options?: { removeView?: boolean }) => {
      if (options?.removeView) this.canvas.remove();
      this.scheduler.destroy();
      this.accessibility.destroy();
      this.events.destroy();
      this.filter.destroy();
      this.view.destroy();
      pixiFake.renderers = pixiFake.renderers.filter((renderer) => renderer !== this);
    });
    constructor() {
      pixiFake.created.push(this);
    }
    async init(options: Record<string, unknown> & { canvas?: HTMLCanvasElement }): Promise<void> {
      pixiFake.initCalls += 1;
      pixiFake.initOptions.push(options);
      if (options.canvas) this.canvas = options.canvas;
      if (pixiFake.initGate) await pixiFake.initGate;
      // What PixiJS 8 has done before a lost context can make `init` throw (at the context or
      // limits system): the event system's constructor claimed the global events ticker, the
      // scheduler joined `Ticker.system`, the view cached the canvas texture and registered its
      // screen, the accessibility system listens for `keydown` on `globalThis` (and, on phones and
      // tablets, its constructor appended a touch-hook button to `document.body`), and the filter
      // system for the global `TexturePool`'s `evict`.
      const touchHook = document.createElement('button');
      touchHook.dataset.pixiTouchHook = String(this.screenKey);
      document.body.append(touchHook);
      this.touchHook = touchHook;
      pixiFake.eventsTickerOwner = this.events;
      pixiFake.systemTickerListeners.add(pixiFake.eventsTickerListener);
      pixiFake.systemTickerListeners.add(this.scheduler);
      pixi.getCanvasTexture(this.canvas);
      pixiFake.poolScreens.add(this.screenKey);
      pixiFake.windowKeydownListeners.add(this.accessibility);
      pixiFake.texturePoolEvictListeners.add(this.filter);
      if (pixiFake.initFailures > 0) {
        pixiFake.initFailures -= 1;
        throw new Error('WebGL context lost during init');
      }
      this.limitsInitialised = true;
      // GlContextSystem's restore handler, registered before the stage's own watch.
      this.canvas.addEventListener('webglcontextrestored', () => {
        if (pixiFake.pixiRestoreThrows) {
          throw new Error('WebGL context lost during `checkMaxIfStatementsInShader`');
        }
        for (const item of this.runners.contextChange.items) item.contextChange();
      });
      pixiFake.renderers.push(this);
    }
  }
  class FakeTickerImpl implements FakeTicker {
    started = false;
    lastTime = 0;
    maxFPS = 0;
    readonly callbacks = new Set<() => void>();
    readonly start = vi.fn(() => {
      this.started = true;
    });
    readonly stop = vi.fn(() => {
      this.started = false;
    });
    constructor() {
      pixiFake.tickers.push(this);
    }
    add(callback: () => void) {
      this.callbacks.add(callback);
    }
    remove(callback: () => void) {
      this.callbacks.delete(callback);
    }
  }
  return { ...pixi, WebGLRenderer: FakeWebGLRenderer, Ticker: FakeTickerImpl };
});

function contextEvent(type: 'webglcontextlost' | 'webglcontextrestored'): Event {
  return new Event(type, { cancelable: true });
}

/** The renderer the stage currently draws with. */
function current(): FakeRenderer {
  const renderer = pixiFake.renderers.at(-1);
  if (!renderer) throw new Error('stage renderer not created');
  return renderer;
}

/** The stage's frame loop; one for the stage's whole life. */
function ticker(): FakeTicker {
  const [only, ...others] = pixiFake.tickers;
  if (!only || others.length > 0) throw new Error('expected exactly one stage ticker');
  return only;
}

/** Runs one frame of the stage's ticker. */
function runFrame(): void {
  for (const callback of ticker().callbacks) callback();
}

async function mountedStage() {
  const { sharedSceneStage } = await import('@/scene/stage');
  const stage = await sharedSceneStage();
  const host = document.createElement('div');
  document.body.append(host);
  const root = new Container();
  const release = stage.mountOverlay(host, root, () => {});
  // Fitting the canvas to the host draws the first frame; the tests count draws from here.
  current().render.mockClear();
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
    // jsdom has no canvas contexts: the dot texture only needs the 2D drawing calls to exist, and
    // a WebGL context only what the stage itself calls. Like a browser, a canvas keeps the first
    // context it is given and returns null for another context type.
    const context2d = { fillStyle: '', beginPath() {}, arc() {}, fill() {} };
    const webglContexts = new WeakMap<HTMLCanvasElement, { type: string; context: object }>();
    Object.defineProperty(HTMLCanvasElement.prototype, 'getContext', {
      configurable: true,
      value(this: HTMLCanvasElement, type: string, attributes?: WebGLContextAttributes) {
        if (type !== 'webgl2' && type !== 'webgl') {
          return pixiFake.canvas2dUnavailable ? null : context2d;
        }
        const existing = webglContexts.get(this);
        if (existing) return existing.type === type ? existing.context : null;
        pixiFake.webglRequests.push({ canvas: this, type, attributes });
        if (type === 'webgl2' && pixiFake.webgl2Unavailable) return null;
        if (pixiFake.contextFailures > 0) {
          // The WebGL 1 fallback is the last try of one creation.
          if (type === 'webgl') pixiFake.contextFailures -= 1;
          return null;
        }
        const lost = pixiFake.lostOnCreate;
        const context = {
          isContextLost: () => lost,
          getExtension: (name: string) =>
            name === 'WEBGL_lose_context'
              ? { loseContext: () => pixiFake.releasedContexts.push(this) }
              : null,
        };
        webglContexts.set(this, { type, context });
        return context;
      },
    });
  });

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    pixiFake.initFailures = 0;
    pixiFake.contextFailures = 0;
    pixiFake.webgl2Unavailable = false;
    pixiFake.lostOnCreate = false;
    pixiFake.initGate = null;
    pixiFake.pixiRestoreThrows = false;
    pixiFake.canvas2dUnavailable = false;
    for (const renderer of pixiFake.created) {
      renderer.render.mockClear();
      renderer.resize.mockClear();
    }
    for (const frames of pixiFake.tickers) {
      frames.start.mockClear();
      frames.stop.mockClear();
    }
  });

  /** Loses the current context and waits past the deadline for the rebuild to finish. */
  async function loseForever(lost: FakeRenderer): Promise<void> {
    const { CONTEXT_RESTORE_DEADLINE_MS } = await import('@/scene/stage');
    lost.canvas.dispatchEvent(contextEvent('webglcontextlost'));
    await vi.advanceTimersByTimeAsync(CONTEXT_RESTORE_DEADLINE_MS);
    await flush();
  }

  it('creates the WebGL context itself, as PixiJS would, and has PixiJS take it over', async () => {
    const { release } = await mountedStage();
    release();
    const startup = pixiFake.renderers[0];
    expect(startup).toBeDefined();
    expect(pixiFake.webglRequests[0]).toEqual({
      canvas: startup?.canvas,
      type: 'webgl2',
      attributes: {
        alpha: true,
        premultipliedAlpha: true,
        antialias: true,
        stencil: true,
        preserveDrawingBuffer: false,
        powerPreference: 'default',
      },
    });
    expect(pixiFake.initOptions[0]).toMatchObject({
      canvas: startup?.canvas,
      preferWebGLVersion: 2,
      skipExtensionImports: true,
    });
    expect(startup?.canvas.classList.contains('scene-canvas')).toBe(true);
  });

  it('falls back to WebGL 1 and has PixiJS take over that same context', async () => {
    const { release } = await mountedStage();
    const lost = current();
    pixiFake.webgl2Unavailable = true;
    const requests = pixiFake.webglRequests.length;

    await loseForever(lost);

    const next = current();
    expect(next).not.toBe(lost);
    expect(pixiFake.webglRequests.slice(requests).map((request) => request.type)).toEqual([
      'webgl2',
      'webgl',
    ]);
    expect(pixiFake.initOptions.at(-1)).toMatchObject({
      canvas: next.canvas,
      preferWebGLVersion: 1,
    });
    // PixiJS asks for the version it was told; the canvas hands back the context already made.
    const webgl1 = next.canvas.getContext('webgl');
    expect(webgl1).not.toBeNull();
    expect(next.canvas.getContext('webgl2')).toBeNull();
    release();
  });

  it('pauses while lost and resumes the animation on restore', async () => {
    const { release } = await mountedStage();
    const renderer = current();
    expect(ticker().started).toBe(true);

    expect(() => renderer.canvas.dispatchEvent(contextEvent('webglcontextlost'))).not.toThrow();
    expect(ticker().started).toBe(false);
    expect(renderer.render).not.toHaveBeenCalled();

    renderer.canvas.dispatchEvent(contextEvent('webglcontextrestored'));
    expect(ticker().started).toBe(true);
    release();
  });

  it('redraws a still frame once the context is restored', async () => {
    const { stage, root, release } = await mountedStage();
    const renderer = current();
    stage.setOverlayAnimating(root, false);
    renderer.render.mockClear();

    renderer.canvas.dispatchEvent(contextEvent('webglcontextlost'));
    expect(renderer.render).not.toHaveBeenCalled();
    renderer.canvas.dispatchEvent(contextEvent('webglcontextrestored'));
    expect(ticker().started).toBe(false);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    release();
  });

  it('draws nothing when an overlay pauses while the context is lost, and redraws on restore', async () => {
    const { stage, root, release } = await mountedStage();
    const renderer = current();
    expect(ticker().started).toBe(true);

    renderer.canvas.dispatchEvent(contextEvent('webglcontextlost'));
    renderer.render.mockClear();
    stage.setOverlayAnimating(root, false);
    expect(renderer.render).not.toHaveBeenCalled();

    renderer.canvas.dispatchEvent(contextEvent('webglcontextrestored'));
    expect(ticker().started).toBe(false);
    expect(renderer.render).toHaveBeenCalledTimes(1);
    release();
  });

  it('resizes but draws nothing while the context is lost, and redraws on restore and later resizes', async () => {
    const { stage, root, release } = await mountedStage();
    const renderer = current();
    stage.setOverlayAnimating(root, false);
    const fireResize = () => {
      for (const callback of pixiFake.resizeCallbacks) callback();
    };
    expect(pixiFake.resizeCallbacks).toHaveLength(1);

    renderer.canvas.dispatchEvent(contextEvent('webglcontextlost'));
    renderer.render.mockClear();
    renderer.resize.mockClear();
    fireResize();
    expect(renderer.resize).toHaveBeenCalledTimes(1);
    expect(renderer.render).not.toHaveBeenCalled();

    renderer.canvas.dispatchEvent(contextEvent('webglcontextrestored'));
    expect(renderer.render).toHaveBeenCalledTimes(1);
    fireResize();
    expect(renderer.render).toHaveBeenCalledTimes(2);
    release();
  });

  it('does not rebuild when the context is restored before the deadline', async () => {
    const { CONTEXT_RESTORE_DEADLINE_MS } = await import('@/scene/stage');
    const { release } = await mountedStage();
    const renderer = current();
    const created = pixiFake.created.length;

    renderer.canvas.dispatchEvent(contextEvent('webglcontextlost'));
    await vi.advanceTimersByTimeAsync(CONTEXT_RESTORE_DEADLINE_MS - 1);
    renderer.canvas.dispatchEvent(contextEvent('webglcontextrestored'));
    await vi.advanceTimersByTimeAsync(CONTEXT_RESTORE_DEADLINE_MS);

    expect(pixiFake.created).toHaveLength(created);
    expect(renderer.destroy).not.toHaveBeenCalled();
    expect(ticker().started).toBe(true);
    release();
  });

  it('rebuilds on a new canvas when the context is never restored, moving the whole scene over', async () => {
    const { CONTEXT_RESTORE_DEADLINE_MS } = await import('@/scene/stage');
    const { stage, host, root, release } = await mountedStage();
    stage.setFrameRate(30);
    const lost = current();
    const world = root.parent;
    expect(world).not.toBeNull();
    const lostRoot = world?.parent;
    expect(lostRoot).toBeTruthy();
    expect(host.contains(lost.canvas)).toBe(true);

    await loseForever(lost);

    const next = current();
    expect(next).not.toBe(lost);
    // The old renderer and its root go, the stage's world (seats and the overlay) does not.
    expect(lost.destroy).toHaveBeenCalledWith({ removeView: true });
    expect(lostRoot?.destroyed).toBe(true);
    expect(root.parent).toBe(world);
    expect(world?.destroyed).toBe(false);
    expect(world?.parent).not.toBe(lostRoot);
    // Drawn again where the old canvas was, by the same ticker at the same frame cap.
    expect(host.contains(next.canvas)).toBe(true);
    expect(host.contains(lost.canvas)).toBe(false);
    expect(ticker().maxFPS).toBe(30);
    expect(ticker().callbacks.size).toBe(1);
    expect(ticker().started).toBe(true);
    next.render.mockClear();
    lost.render.mockClear();
    runFrame();
    expect(lost.render).not.toHaveBeenCalled();
    expect(next.render).toHaveBeenCalledExactlyOnceWith({ container: world?.parent });

    // A late restore on the abandoned canvas is not observed; the new canvas is.
    ticker().start.mockClear();
    lost.canvas.dispatchEvent(contextEvent('webglcontextrestored'));
    await vi.advanceTimersByTimeAsync(CONTEXT_RESTORE_DEADLINE_MS);
    expect(current()).toBe(next);
    expect(ticker().start).not.toHaveBeenCalled();
    next.canvas.dispatchEvent(contextEvent('webglcontextlost'));
    expect(ticker().started).toBe(false);
    next.canvas.dispatchEvent(contextEvent('webglcontextrestored'));
    expect(ticker().started).toBe(true);
    release();
  });

  // Placing the new canvas draws the moved scene. In a browser the ResizeObserver then reports the
  // initial size and draws it again; the stub observer here does not report on `observe`.
  it('redraws a still scene when the rebuild places the new canvas', async () => {
    const { stage, root, release } = await mountedStage();
    stage.setOverlayAnimating(root, false);
    const lost = current();

    await loseForever(lost);

    const next = current();
    expect(next).not.toBe(lost);
    expect(ticker().started).toBe(false);
    expect(next.render).toHaveBeenCalledExactlyOnceWith({ container: root.parent?.parent });
    release();
  });

  it('counts lost time only while the page is visible', async () => {
    const { CONTEXT_RESTORE_DEADLINE_MS } = await import('@/scene/stage');
    const { release } = await mountedStage();
    const renderer = current();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);

    renderer.canvas.dispatchEvent(contextEvent('webglcontextlost'));
    await vi.advanceTimersByTimeAsync(CONTEXT_RESTORE_DEADLINE_MS * 3);
    expect(current()).toBe(renderer);

    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(CONTEXT_RESTORE_DEADLINE_MS - 1);
    expect(current()).toBe(renderer);
    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(current()).not.toBe(renderer);
    hidden.mockRestore();
    release();
  });

  it('retries a failed rebuild after a backoff and rebuilds once a context can be created', async () => {
    const { CONTEXT_RESTORE_DEADLINE_MS } = await import('@/scene/stage');
    const { stage, host, root, release } = await mountedStage();
    stage.setOverlayAnimating(root, false);
    const lost = current();
    pixiFake.contextFailures = 1;
    const calls = pixiFake.initCalls;
    const requests = pixiFake.webglRequests.length;
    const warning = vi.spyOn(console, 'warn');

    await loseForever(lost);
    expect(warning).toHaveBeenCalledWith(
      '[Scene] Scene rebuild failed; retrying',
      expect.objectContaining({ errorMessage: 'No WebGL context could be created' }),
      expect.any(Error),
    );
    warning.mockRestore();
    // Both WebGL versions were tried; PixiJS init was never reached.
    expect(pixiFake.webglRequests.slice(requests).map((request) => request.type)).toEqual([
      'webgl2',
      'webgl',
    ]);
    expect(pixiFake.initCalls).toBe(calls);
    expect(current()).toBe(lost);
    expect(lost.destroy).not.toHaveBeenCalled();

    // The retry waits twice as long.
    await vi.advanceTimersByTimeAsync(CONTEXT_RESTORE_DEADLINE_MS * 2 - 1);
    expect(pixiFake.webglRequests).toHaveLength(requests + 2);
    await vi.advanceTimersByTimeAsync(1);
    await flush();
    expect(pixiFake.initCalls).toBe(calls + 1);

    const next = current();
    expect(next).not.toBe(lost);
    expect(lost.destroy).toHaveBeenCalledWith({ removeView: true });
    expect(host.contains(next.canvas)).toBe(true);
    expect(next.render).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
    release();
  });

  it('resumes the old canvas when its context comes back after a failed rebuild', async () => {
    const { CONTEXT_RESTORE_DEADLINE_MS } = await import('@/scene/stage');
    const { release } = await mountedStage();
    const lost = current();
    pixiFake.contextFailures = 1;
    const requests = pixiFake.webglRequests.length;

    await loseForever(lost);
    expect(pixiFake.webglRequests).toHaveLength(requests + 2);
    expect(ticker().started).toBe(false);

    lost.canvas.dispatchEvent(contextEvent('webglcontextrestored'));
    expect(ticker().started).toBe(true);
    // The armed retry is dropped: nothing more is created.
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(CONTEXT_RESTORE_DEADLINE_MS * 100);
    expect(pixiFake.webglRequests).toHaveLength(requests + 2);
    expect(current()).toBe(lost);
    release();
  });

  it('stops creating contexts after the last failed attempt but still resumes on a late restore', async () => {
    const { CONTEXT_RESTORE_DEADLINE_MS, MAX_REBUILD_ATTEMPTS } = await import('@/scene/stage');
    const { release } = await mountedStage();
    const lost = current();
    pixiFake.contextFailures = MAX_REBUILD_ATTEMPTS;
    const requests = pixiFake.webglRequests.length;
    const calls = pixiFake.initCalls;

    lost.canvas.dispatchEvent(contextEvent('webglcontextlost'));
    for (let attempt = 0; attempt < MAX_REBUILD_ATTEMPTS; attempt += 1) {
      await vi.advanceTimersByTimeAsync(CONTEXT_RESTORE_DEADLINE_MS * 2 ** attempt);
      await flush();
      expect(pixiFake.webglRequests).toHaveLength(requests + 2 * (attempt + 1));
    }
    expect(vi.getTimerCount()).toBe(0);
    await vi.advanceTimersByTimeAsync(CONTEXT_RESTORE_DEADLINE_MS * 100);
    expect(pixiFake.webglRequests).toHaveLength(requests + 2 * MAX_REBUILD_ATTEMPTS);
    expect(pixiFake.initCalls).toBe(calls);
    expect(current()).toBe(lost);
    expect(ticker().started).toBe(false);

    lost.canvas.dispatchEvent(contextEvent('webglcontextrestored'));
    expect(ticker().started).toBe(true);

    // The next loss starts a fresh wait with all its attempts.
    await loseForever(lost);
    expect(current()).not.toBe(lost);
    release();
  });

  it('discards the new renderer when the old context is restored while the rebuild is in flight', async () => {
    const { CONTEXT_RESTORE_DEADLINE_MS } = await import('@/scene/stage');
    const { host, release } = await mountedStage();
    const lost = current();
    let open = () => {};
    pixiFake.initGate = new Promise((resolve) => {
      open = resolve;
    });

    lost.canvas.dispatchEvent(contextEvent('webglcontextlost'));
    await vi.advanceTimersByTimeAsync(CONTEXT_RESTORE_DEADLINE_MS);
    lost.canvas.dispatchEvent(contextEvent('webglcontextrestored'));
    expect(ticker().started).toBe(true);
    open();
    await flush();

    // The finished renderer was created and immediately destroyed with its canvas.
    const discarded = pixiFake.created.at(-1);
    expect(discarded).not.toBe(lost);
    expect(discarded?.destroy).toHaveBeenCalledWith({ removeView: true });
    expect(current()).toBe(lost);
    expect(host.contains(lost.canvas)).toBe(true);
    expect(lost.destroy).not.toHaveBeenCalled();
    expect(ticker().callbacks.size).toBe(1);
    // The old canvas is still the watched one.
    lost.canvas.dispatchEvent(contextEvent('webglcontextlost'));
    expect(ticker().started).toBe(false);
    lost.canvas.dispatchEvent(contextEvent('webglcontextrestored'));
    expect(ticker().started).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    release();
  });

  it('treats a context created already lost as a failed rebuild, without reaching PixiJS init', async () => {
    const { CONTEXT_RESTORE_DEADLINE_MS } = await import('@/scene/stage');
    const { release } = await mountedStage();
    const lost = current();
    pixiFake.lostOnCreate = true;
    const calls = pixiFake.initCalls;

    await loseForever(lost);
    expect(pixiFake.initCalls).toBe(calls);
    expect(current()).toBe(lost);

    pixiFake.lostOnCreate = false;
    await vi.advanceTimersByTimeAsync(CONTEXT_RESTORE_DEADLINE_MS * 2);
    await flush();
    expect(current()).not.toBe(lost);
    release();
  });

  it('leaves no global reference to a renderer whose init fails, and releases its context', async () => {
    const { CONTEXT_RESTORE_DEADLINE_MS } = await import('@/scene/stage');
    const { release } = await mountedStage();
    const lost = current();
    const listeners = new Set(pixiFake.systemTickerListeners);
    const eventsOwner = pixiFake.eventsTickerOwner;
    const screens = new Set(pixiFake.poolScreens);
    pixiFake.initFailures = 1;
    const calls = pixiFake.initCalls;

    await loseForever(lost);
    expect(pixiFake.initCalls).toBe(calls + 1);
    const failed = pixiFake.created.at(-1);
    expect(failed).toBeDefined();
    expect(failed).not.toBe(lost);
    if (!failed) return;
    expect(current()).toBe(lost);
    // Global PixiJS state is back to what it was: the scheduler left `Ticker.system`, the events
    // ticker no longer serves the failed renderer, its pool screens and canvas texture are gone.
    expect(pixiFake.systemTickerListeners.has(failed.scheduler)).toBe(false);
    expect(pixiFake.eventsTickerOwner).not.toBe(failed.events);
    expect(pixiFake.poolScreens.has(failed.screenKey)).toBe(false);
    expect(hasCachedCanvasTexture(failed.canvas)).toBe(false);
    expect(pixiFake.windowKeydownListeners.has(failed.accessibility)).toBe(false);
    expect(pixiFake.texturePoolEvictListeners.has(failed.filter)).toBe(false);
    expect(failed.touchHook).toBeNull();
    expect(document.body.querySelector(`[data-pixi-touch-hook="${failed.screenKey}"]`)).toBeNull();
    expect(pixiFake.releasedContexts).toContain(failed.canvas);
    // Every system is destroyed, even after one that throws (`limits`, whose init never ran), and
    // no render pipe is: the full renderer destroy would stop at the first pipe that throws.
    expect(failed.renderPipes.smoothGraphics.destroy).not.toHaveBeenCalled();
    expect(failed.destroy).not.toHaveBeenCalled();
    expect(pixiFake.windowKeydownListeners.has(lost.accessibility)).toBe(true);
    expect(pixiFake.texturePoolEvictListeners.has(lost.filter)).toBe(true);
    expect(lost.touchHook?.isConnected).toBe(true);
    // The live renderer's own registrations are untouched.
    expect(pixiFake.poolScreens).toEqual(screens);
    for (const listener of listeners) {
      if (listener !== pixiFake.eventsTickerListener) {
        expect(pixiFake.systemTickerListeners.has(listener)).toBe(true);
      }
    }
    expect(eventsOwner).not.toBe(failed.events);

    // Still retried like any failed rebuild.
    await vi.advanceTimersByTimeAsync(CONTEXT_RESTORE_DEADLINE_MS * 2);
    await flush();
    expect(current()).not.toBe(lost);
    release();
  });

  it('adopts the new renderer when the old context is restored and lost again while the rebuild is in flight', async () => {
    const { CONTEXT_RESTORE_DEADLINE_MS } = await import('@/scene/stage');
    const { host, release } = await mountedStage();
    const lost = current();
    let open = () => {};
    pixiFake.initGate = new Promise((resolve) => {
      open = resolve;
    });

    lost.canvas.dispatchEvent(contextEvent('webglcontextlost'));
    await vi.advanceTimersByTimeAsync(CONTEXT_RESTORE_DEADLINE_MS);
    lost.canvas.dispatchEvent(contextEvent('webglcontextrestored'));
    lost.canvas.dispatchEvent(contextEvent('webglcontextlost'));
    // No second rebuild is armed while the first is in flight.
    expect(vi.getTimerCount()).toBe(0);
    open();
    await flush();

    // The old canvas is lost again, so the finished renderer replaces it at once.
    const next = current();
    expect(next).not.toBe(lost);
    expect(lost.destroy).toHaveBeenCalledWith({ removeView: true });
    expect(host.contains(next.canvas)).toBe(true);
    expect(ticker().started).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    release();
  });

  // The fake throws at the start of PixiJS's restore handler. Real PixiJS throws partway through
  // its context-change runner (at the limits system), so the systems ahead of it already hold the
  // new context, and in a browser the second loss event arrives asynchronously, so the restarted
  // ticker may draw a few frames first; drawing on a lost context is a no-op. What these tests pin
  // is the stage's side: it keeps watching, pauses on the next loss, and recovers by a full restore
  // (which re-sends the context to every system) or by a rebuild.
  it('recovers when PixiJS throws in its own restore handler because the context is lost again', async () => {
    const { CONTEXT_RESTORE_DEADLINE_MS } = await import('@/scene/stage');
    const { host, release } = await mountedStage();
    const lost = current();
    const reported: unknown[] = [];
    const onError = (event: ErrorEvent) => {
      reported.push(event.error);
      event.preventDefault();
    };
    window.addEventListener('error', onError);
    pixiFake.pixiRestoreThrows = true;

    lost.canvas.dispatchEvent(contextEvent('webglcontextlost'));
    // PixiJS's handler throws; the browser reports it and still runs the stage's watch.
    lost.canvas.dispatchEvent(contextEvent('webglcontextrestored'));
    expect(reported).toHaveLength(1);
    expect(ticker().started).toBe(false);

    // Even if no further loss event arrives, the rebuild takes over.
    await vi.advanceTimersByTimeAsync(CONTEXT_RESTORE_DEADLINE_MS);
    await flush();
    const next = current();
    expect(next).not.toBe(lost);
    expect(host.contains(next.canvas)).toBe(true);
    expect(ticker().started).toBe(true);
    window.removeEventListener('error', onError);
    release();
  });

  it('resumes on the next full restore after PixiJS threw in its restore handler', async () => {
    const { CONTEXT_RESTORE_DEADLINE_MS } = await import('@/scene/stage');
    const { release } = await mountedStage();
    const lost = current();
    const onError = (event: ErrorEvent) => event.preventDefault();
    window.addEventListener('error', onError);
    pixiFake.pixiRestoreThrows = true;

    lost.canvas.dispatchEvent(contextEvent('webglcontextlost'));
    lost.canvas.dispatchEvent(contextEvent('webglcontextrestored'));
    pixiFake.pixiRestoreThrows = false;
    await vi.advanceTimersByTimeAsync(CONTEXT_RESTORE_DEADLINE_MS - 1);
    lost.canvas.dispatchEvent(contextEvent('webglcontextrestored'));

    expect(ticker().started).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
    expect(current()).toBe(lost);
    window.removeEventListener('error', onError);
    release();
  });

  it('notifies an overlay mounted during a loss and when the scene recovers', async () => {
    const { stage, release } = await mountedStage();
    const renderer = current();
    renderer.canvas.dispatchEvent(contextEvent('webglcontextlost'));
    release();
    const onAvailabilityChange = vi.fn();
    const host = document.createElement('div');
    const root = stage.createOverlayRoot();
    const releaseOverlay = stage.mountOverlay(host, root, () => {}, onAvailabilityChange);
    expect(onAvailabilityChange).toHaveBeenLastCalledWith(false);
    renderer.canvas.dispatchEvent(contextEvent('webglcontextrestored'));
    expect(onAvailabilityChange).toHaveBeenLastCalledWith(true);
    releaseOverlay();
  });

  it('destroys the initialized renderer if the dot texture cannot be created', async () => {
    vi.resetModules();
    pixiFake.canvas2dUnavailable = true;
    const { sharedSceneStage } = await import('@/scene/stage');
    await expect(sharedSceneStage()).rejects.toThrow(
      'Canvas 2D is unavailable for the dot texture',
    );
    const renderer = pixiFake.created.at(-1);
    expect(renderer?.destroy).toHaveBeenCalledWith({ removeView: true });
    expect(renderer?.touchHook).toBeNull();
  });
});
