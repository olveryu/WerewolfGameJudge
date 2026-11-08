/**
 * Scene stage: the single PixiJS application behind every animated decoration
 * (docs/web-client-rewrite.md §5.3).
 *
 * - One WebGL context for the whole app, created on first use. WebGL is required: when it is
 *   unavailable `init` rejects and the caller surfaces the failure; there is no degraded mode.
 * - The ticker runs only while decorations are mounted, a host is attached and the page is
 *   visible; otherwise no frames are produced. Its frame cap is the user's 60 / 30 setting.
 * - Decorations are sampled every frame from their pure samplers; React never re-renders for
 *   motion.
 */
import { Application, Container, Graphics, GraphicsContext, Sprite, type Texture } from 'pixi.js';

import {
  type DecorationNode,
  type DecorationSpec,
  type DotNode,
  type LayerArt,
  type LayerNode,
  loopProgress,
} from '@/scene/decoration';

/** Frame caps offered by the settings page (decision D3). */
export type SceneFrameRate = 60 | 30;

/** A seat tile in the host's coordinate space. */
export interface SeatRect {
  x: number;
  y: number;
  size: number;
}

/** Handle for one mounted decoration. */
export interface DecorationHandle {
  setRect(rect: SeatRect): void;
  destroy(): void;
}

/** Radius of the shared white dot texture; dots are tinted and scaled from it. */
const DOT_TEXTURE_RADIUS = 32;
const MAX_RESOLUTION = 2;
const DEG_TO_RAD = Math.PI / 180;

interface AnimatedNode {
  readonly displayObject: Sprite | Graphics;
  update(timeMs: number, size: number): void;
}

class MountedDecoration implements DecorationHandle {
  readonly container = new Container();
  private size = 0;

  constructor(
    private readonly stage: SceneStage,
    private readonly nodes: readonly AnimatedNode[],
  ) {
    for (const node of nodes) this.container.addChild(node.displayObject);
  }

  setRect(rect: SeatRect): void {
    this.container.position.set(rect.x, rect.y);
    this.size = rect.size;
  }

  update(timeMs: number): void {
    if (this.size === 0) return;
    for (const node of this.nodes) node.update(timeMs, this.size);
  }

  destroy(): void {
    this.stage.unmount(this);
    this.container.destroy({ children: true });
  }
}

class SceneStage {
  private readonly decorations = new Set<MountedDecoration>();
  private readonly artContexts = new WeakMap<LayerArt, Map<number, GraphicsContext>>();
  private host: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    private readonly application: Application,
    private readonly dotTexture: Texture,
  ) {
    application.ticker.add(() => {
      const timeMs = application.ticker.lastTime;
      for (const decoration of this.decorations) decoration.update(timeMs);
    });
    document.addEventListener('visibilitychange', () => this.syncTicker());
  }

  /** Places the canvas over `host` and sizes it to the host. One host at a time. */
  attach(host: HTMLElement): void {
    if (this.host) {
      throw new Error('Scene stage is already attached to another host');
    }
    this.host = host;
    host.append(this.application.canvas);
    this.application.resizeTo = host;
    this.resizeObserver = new ResizeObserver(() => this.application.resize());
    this.resizeObserver.observe(host);
    this.syncTicker();
  }

  detach(host: HTMLElement): void {
    if (this.host !== host) {
      throw new Error('Scene stage is not attached to this host');
    }
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.application.canvas.remove();
    this.host = null;
    this.syncTicker();
  }

  setFrameRate(frameRate: SceneFrameRate): void {
    this.application.ticker.maxFPS = frameRate;
  }

  mount(spec: DecorationSpec): DecorationHandle {
    const decoration = new MountedDecoration(
      this,
      spec.nodes.map((node) => this.createNode(node)),
    );
    this.application.stage.addChild(decoration.container);
    this.decorations.add(decoration);
    this.syncTicker();
    return decoration;
  }

  unmount(decoration: MountedDecoration): void {
    this.application.stage.removeChild(decoration.container);
    this.decorations.delete(decoration);
    this.syncTicker();
  }

  private syncTicker(): void {
    const shouldRun = this.host !== null && this.decorations.size > 0 && !document.hidden;
    const ticker = this.application.ticker;
    if (shouldRun && !ticker.started) ticker.start();
    if (!shouldRun && ticker.started) ticker.stop();
  }

  private createNode(node: DecorationNode): AnimatedNode {
    return node.kind === 'dot' ? this.createDot(node) : this.createLayer(node);
  }

  private createDot(node: DotNode): AnimatedNode {
    const sprite = new Sprite({ texture: this.dotTexture, anchor: 0.5, tint: node.color });
    return {
      displayObject: sprite,
      update: (timeMs, size) => {
        const frame = node.sample(loopProgress(timeMs, node.durationMs, node.phase), size);
        sprite.position.set(frame.cx, frame.cy);
        sprite.scale.set(frame.r / DOT_TEXTURE_RADIUS);
        sprite.alpha = frame.opacity;
      },
    };
  }

  private createLayer(node: LayerNode): AnimatedNode {
    const graphics = new Graphics();
    let artSize = 0;
    return {
      displayObject: graphics,
      update: (timeMs, size) => {
        if (size !== artSize) {
          graphics.context = this.artContext(node.art, size);
          artSize = size;
        }
        const frame = node.sample(loopProgress(timeMs, node.durationMs, node.phase), size);
        graphics.position.set(frame.x, frame.y);
        graphics.rotation = frame.rotateDeg * DEG_TO_RAD;
        graphics.scale.set(frame.scaleX, frame.scaleY);
        graphics.alpha = frame.opacity;
      },
    };
  }

  /** Geometry is shared by every seat that shows the same art at the same tile size. */
  private artContext(art: LayerArt, size: number): GraphicsContext {
    let bySize = this.artContexts.get(art);
    if (!bySize) {
      bySize = new Map();
      this.artContexts.set(art, bySize);
    }
    let context = bySize.get(size);
    if (!context) {
      context = new GraphicsContext();
      art(context, size);
      bySize.set(size, context);
    }
    return context;
  }
}

export type { SceneStage };

/**
 * Creates the stage. Call through `sceneStagePromise()`, which keeps it app-wide.
 *
 * @returns the stage; rejects when WebGL is unavailable
 */
export async function createSceneStage(): Promise<SceneStage> {
  const application = new Application();
  await application.init({
    // WebGL only: an array preference makes PixiJS throw instead of falling back to another
    // renderer when WebGL is unavailable.
    preference: ['webgl'],
    backgroundAlpha: 0,
    antialias: true,
    resolution: Math.min(window.devicePixelRatio, MAX_RESOLUTION),
    autoDensity: true,
    autoStart: false,
  });
  const canvas = application.canvas;
  canvas.setAttribute('aria-hidden', 'true');
  canvas.classList.add('scene-canvas');

  const dot = new Graphics().circle(0, 0, DOT_TEXTURE_RADIUS).fill(0xffffff);
  const dotTexture = application.renderer.generateTexture(dot);
  dot.destroy();

  return new SceneStage(application, dotTexture);
}
