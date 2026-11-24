import { Container } from 'pixi.js';

/** The parts of a PixiJS `Application` the stage drives, recorded for assertions. */
const app = vi.hoisted(() => {
  const ticker = {
    started: false,
    lastTime: 0,
    maxFPS: 0,
    add: vi.fn(),
    start: vi.fn(() => {
      ticker.started = true;
    }),
    stop: vi.fn(() => {
      ticker.started = false;
    }),
  };
  return {
    ticker,
    render: vi.fn(),
    resize: vi.fn(),
    canvas: null as HTMLCanvasElement | null,
    resizeCallbacks: [] as Array<() => void>,
  };
});

vi.mock('pixi.js/browser', () => ({}));
vi.mock('pixi.js', async (importOriginal) => {
  const pixi = await importOriginal<typeof import('pixi.js')>();
  class FakeApplication {
    readonly stage = new pixi.Container();
    readonly ticker = app.ticker;
    readonly renderer = { resolution: 1 };
    readonly canvas = document.createElement('canvas');
    readonly render = app.render;
    readonly resize = app.resize;
    resizeTo: HTMLElement | null = null;
    async init(): Promise<void> {
      app.canvas = this.canvas;
    }
  }
  return { ...pixi, Application: FakeApplication };
});

function contextEvent(type: 'webglcontextlost' | 'webglcontextrestored'): Event {
  return new Event(type, { cancelable: true });
}

function sceneCanvas(): HTMLCanvasElement {
  if (!app.canvas) throw new Error('stage canvas not created');
  return app.canvas;
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
          app.resizeCallbacks.push(this.callback);
        }
        disconnect() {
          app.resizeCallbacks = app.resizeCallbacks.filter((c) => c !== this.callback);
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
    app.render.mockClear();
    app.ticker.start.mockClear();
    app.ticker.stop.mockClear();
  });

  it('keeps the context restorable, pauses while lost, and resumes the animation on restore', async () => {
    const { sharedSceneStage } = await import('@/scene/stage');
    const stage = await sharedSceneStage();
    const host = document.createElement('div');
    document.body.append(host);
    const root = new Container();
    const release = stage.mountOverlay(host, root, () => {});
    expect(app.ticker.started).toBe(true);

    expect(() => sceneCanvas().dispatchEvent(contextEvent('webglcontextlost'))).not.toThrow();
    expect(app.ticker.started).toBe(false);
    expect(app.render).not.toHaveBeenCalled();

    sceneCanvas().dispatchEvent(contextEvent('webglcontextrestored'));
    expect(app.ticker.started).toBe(true);
    release();
  });

  it('redraws a still frame once the context is restored', async () => {
    const { sharedSceneStage } = await import('@/scene/stage');
    const stage = await sharedSceneStage();
    const host = document.createElement('div');
    document.body.append(host);
    const root = new Container();
    const release = stage.mountOverlay(host, root, () => {});
    stage.setOverlayAnimating(root, false);
    app.render.mockClear();

    sceneCanvas().dispatchEvent(contextEvent('webglcontextlost'));
    expect(app.render).not.toHaveBeenCalled();
    sceneCanvas().dispatchEvent(contextEvent('webglcontextrestored'));
    expect(app.ticker.started).toBe(false);
    expect(app.render).toHaveBeenCalledTimes(1);
    release();
  });

  it('draws nothing when an overlay pauses while the context is lost, and redraws on restore', async () => {
    const { sharedSceneStage } = await import('@/scene/stage');
    const stage = await sharedSceneStage();
    const host = document.createElement('div');
    document.body.append(host);
    const root = new Container();
    const release = stage.mountOverlay(host, root, () => {});
    expect(app.ticker.started).toBe(true);

    sceneCanvas().dispatchEvent(contextEvent('webglcontextlost'));
    app.render.mockClear();
    stage.setOverlayAnimating(root, false);
    expect(app.render).not.toHaveBeenCalled();

    sceneCanvas().dispatchEvent(contextEvent('webglcontextrestored'));
    expect(app.ticker.started).toBe(false);
    expect(app.render).toHaveBeenCalledTimes(1);
    release();
  });

  it('draws nothing on resize while the context is lost, and redraws on restore and later resizes', async () => {
    const { sharedSceneStage } = await import('@/scene/stage');
    const stage = await sharedSceneStage();
    const host = document.createElement('div');
    document.body.append(host);
    const root = new Container();
    const release = stage.mountOverlay(host, root, () => {});
    stage.setOverlayAnimating(root, false);
    const fireResize = () => {
      for (const callback of app.resizeCallbacks) callback();
    };
    expect(app.resizeCallbacks.length).toBeGreaterThan(0);

    sceneCanvas().dispatchEvent(contextEvent('webglcontextlost'));
    app.render.mockClear();
    fireResize();
    expect(app.resize).toHaveBeenCalled();
    expect(app.render).not.toHaveBeenCalled();

    sceneCanvas().dispatchEvent(contextEvent('webglcontextrestored'));
    expect(app.render).toHaveBeenCalledTimes(1);
    fireResize();
    expect(app.render).toHaveBeenCalledTimes(2);
    release();
  });
});
