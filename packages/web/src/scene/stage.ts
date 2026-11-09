/**
 * Scene stage: the single PixiJS application behind every animated decoration
 * (docs/web-client-rewrite.md §5.3).
 *
 * - One WebGL context for the whole app, created on first use. WebGL is required: when it is
 *   unavailable `init` rejects and the caller surfaces the failure; there is no degraded mode.
 * - The ticker runs only while decorations are mounted, a host is attached and the page is
 *   visible; otherwise no frames are produced. Its frame cap is the user's 60 / 30 setting.
 * - Decorations are sampled every frame from their pure samplers; React never re-renders for
 *   motion. Display objects and geometry are built when a decoration mounts or its tile size
 *   changes; the per-frame path only writes transforms and alphas. Geometry is shared through
 *   a ref-counted cache, so seats showing the same decoration at the same size share it.
 * - SVG artwork is rasterised into textures (see `svgTexture.ts`), shared the same way and
 *   destroyed with their last user, so leaving the room frees them. A decoration stays hidden
 *   until all of its textures are ready; a failed rasterisation goes to the mount's `onError`.
 */
import { Application, Container, Graphics, GraphicsContext, Sprite, Texture } from 'pixi.js';

import type {
  DashFlowNode,
  DecorationNode,
  DecorationSpec,
  DotNode,
  GroupNode,
  LayerNode,
  LineNode,
  MorphArt,
  MorphMode,
  MorphNode,
  MorphSampler,
  PathNode,
  RingNode,
  SceneColor,
  StaticNode,
  SvgArt,
  SvgNode,
} from '@/scene/decoration';
import {
  assertMorphShape,
  clampOpacity,
  dashFlowCycles,
  dashFlowOffset,
  deriveLineLayout,
  derivePathLayout,
  deriveRingLayout,
  hasVaryingStroke,
  type LinePlacement,
  loopProgress,
  placeLine,
  sampleLoop,
  snapBorderWidth,
  thickWeight,
  windowWeight,
} from '@/scene/loopGeometry';
import { rasterizeSvg } from '@/scene/svgTexture';

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
const DEFAULT_DASH_VARIANTS = 12;

const opaqueSampler: MorphSampler = () => ({ opacity: 1 });

/** Ref-counted geometry keyed by its drawing source (art function or sampler) and a variant key. */
class ContextCache {
  private readonly entries = new WeakMap<
    object,
    Map<string, { context: GraphicsContext; refs: number }>
  >();

  acquire(owner: object, key: string, draw: (context: GraphicsContext) => void): GraphicsContext {
    let byKey = this.entries.get(owner);
    if (!byKey) {
      byKey = new Map();
      this.entries.set(owner, byKey);
    }
    let entry = byKey.get(key);
    if (!entry) {
      const context = new GraphicsContext();
      draw(context);
      entry = { context, refs: 0 };
      byKey.set(key, entry);
    }
    entry.refs += 1;
    return entry.context;
  }

  release(owner: object, key: string): void {
    const byKey = this.entries.get(owner);
    const entry = byKey?.get(key);
    if (!byKey || !entry) {
      throw new Error(`Releasing scene geometry that was never acquired: ${key}`);
    }
    entry.refs -= 1;
    if (entry.refs === 0) {
      byKey.delete(key);
      entry.context.destroy();
    }
  }
}

/** Geometry a node holds for its current tile size; released before it rebuilds or dies. */
class Leases {
  private readonly held: { owner: object; key: string }[] = [];

  constructor(private readonly cache: ContextCache) {}

  acquire(owner: object, key: string, draw: (context: GraphicsContext) => void): GraphicsContext {
    this.held.push({ owner, key });
    return this.cache.acquire(owner, key, draw);
  }

  releaseAll(): void {
    for (const { owner, key } of this.held) this.cache.release(owner, key);
    this.held.length = 0;
  }
}

/** Ref-counted SVG textures keyed by their art and `size|resolution`. */
interface TextureEntry {
  readonly key: string;
  readonly texture: Promise<Texture>;
  /** Set once rasterised. */
  loaded: Texture | null;
  refs: number;
}

class TextureCache {
  private readonly entries = new WeakMap<SvgArt, Map<string, TextureEntry>>();

  acquire(art: SvgArt, size: number, resolution: number): TextureEntry {
    let byKey = this.entries.get(art);
    if (!byKey) {
      byKey = new Map();
      this.entries.set(art, byKey);
    }
    const key = `${size}|${resolution}`;
    let entry = byKey.get(key);
    if (!entry) {
      const created: TextureEntry = {
        key,
        texture: rasterizeSvg(art(size), resolution).then((texture) => {
          created.loaded = texture;
          // Released while rasterising: nobody will show it.
          if (created.refs === 0) texture.destroy(true);
          return texture;
        }),
        loaded: null,
        refs: 0,
      };
      entry = created;
      byKey.set(key, entry);
    }
    entry.refs += 1;
    return entry;
  }

  release(art: SvgArt, entry: TextureEntry): void {
    entry.refs -= 1;
    if (entry.refs > 0) return;
    this.entries.get(art)?.delete(entry.key);
    entry.loaded?.destroy(true);
  }
}

/** Shared services a scene node is built with. */
interface NodeContext {
  readonly leases: Leases;
  readonly textures: TextureCache;
  readonly resolution: number;
  /** Reports a failure the node cannot recover from (e.g. artwork that does not rasterise). */
  readonly onError: (error: Error) => void;
}

interface SceneNode {
  readonly view: Container;
  update(timeMs: number, size: number): void;
  /** Whether everything the node draws is loaded; the decoration shows only when all are. */
  ready(): boolean;
  /** Releases cached geometry; display objects are destroyed with their decoration. */
  release(): void;
}

function colorKey(color: SceneColor): string {
  return typeof color === 'number' ? color.toString(16) : color;
}

class DotSceneNode implements SceneNode {
  readonly view: Sprite;

  constructor(
    private readonly node: DotNode,
    texture: Texture,
  ) {
    this.view = new Sprite({ texture, anchor: 0.5, tint: node.color });
  }

  update(timeMs: number, size: number): void {
    const { node, view } = this;
    const frame = node.sample(loopProgress(timeMs, node.durationMs, node.phase ?? 0), size);
    view.position.set(frame.cx, frame.cy);
    view.scale.set(frame.r / DOT_TEXTURE_RADIUS);
    view.alpha = clampOpacity(frame.opacity);
  }

  ready(): boolean {
    return true;
  }

  release(): void {}
}

/** Base for nodes whose geometry depends on the tile size. */
abstract class SizedSceneNode implements SceneNode {
  abstract readonly view: Container;
  private builtSize = 0;

  constructor(protected readonly leases: Leases) {}

  update(timeMs: number, size: number): void {
    if (size !== this.builtSize) {
      this.leases.releaseAll();
      this.build(size);
      this.builtSize = size;
    }
    this.animate(timeMs, size);
  }

  ready(): boolean {
    return true;
  }

  release(): void {
    this.leases.releaseAll();
  }

  protected abstract build(size: number): void;
  protected abstract animate(timeMs: number, size: number): void;
}

class LineSceneNode extends SizedSceneNode {
  readonly view = new Graphics();
  private layout = { lengthMax: 1, strokeMax: 1, initialAngle: 0 };
  private readonly placement: LinePlacement = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1 };

  constructor(
    private readonly node: LineNode,
    leases: Leases,
  ) {
    super(leases);
  }

  protected build(size: number): void {
    const { node } = this;
    const layout = deriveLineLayout(sampleLoop(node.sample, size, node.durationMs));
    this.layout = layout;
    this.placement.rotation = layout.initialAngle;
    const { lengthMax, strokeMax } = layout;
    this.view.context = this.leases.acquire(
      node.sample,
      `${size}|${colorKey(node.color)}`,
      (context) => {
        context
          .roundRect(-lengthMax / 2, -strokeMax / 2, lengthMax, strokeMax, strokeMax / 2)
          .fill(node.color);
      },
    );
  }

  protected animate(timeMs: number, size: number): void {
    const { node, view, placement } = this;
    const frame = node.sample(loopProgress(timeMs, node.durationMs, node.phase ?? 0), size);
    placeLine(frame, this.layout, placement);
    view.position.set(placement.x, placement.y);
    view.rotation = placement.rotation;
    view.scale.set(placement.scaleX, placement.scaleY);
    view.alpha = clampOpacity(frame.opacity);
  }
}

/** Thinnest and (when the stroke varies) thickest copies with complementary weights. */
class StrokePair {
  readonly thin = new Graphics();
  readonly thick = new Graphics();
  strokeMin = 0;
  strokeMax = 0;
  varying = false;

  setLayout(strokeMin: number, strokeMax: number): void {
    this.strokeMin = strokeMin;
    this.strokeMax = strokeMax;
    this.varying = hasVaryingStroke({ strokeMin, strokeMax });
    this.thick.visible = this.varying;
  }

  /** Width the thin copy is drawn at: the minimum when the stroke varies, else the constant. */
  get thinWidth(): number {
    return this.varying ? this.strokeMin : this.strokeMax;
  }

  setOpacity(opacity: number, strokeWidth: number): void {
    const weight = thickWeight(strokeWidth, this);
    this.thin.alpha = clampOpacity(opacity * (1 - weight));
    this.thick.alpha = clampOpacity(opacity * weight);
  }
}

class RingSceneNode extends SizedSceneNode {
  readonly view = new Container();
  private readonly strokes = new StrokePair();
  private rMax = 1;

  constructor(
    private readonly node: RingNode,
    leases: Leases,
    private readonly resolution: number,
  ) {
    super(leases);
    this.view.addChild(this.strokes.thin, this.strokes.thick);
  }

  protected build(size: number): void {
    const { node, strokes, resolution } = this;
    const layout = deriveRingLayout(sampleLoop(node.sample, size, node.durationMs));
    this.rMax = layout.rMax;
    strokes.setLayout(layout.strokeMin, layout.strokeMax);
    const draw = (width: number) => (context: GraphicsContext) => {
      context
        .circle(0, 0, layout.rMax)
        .stroke({ color: node.color, width: snapBorderWidth(width, resolution) });
    };
    const keyBase = `${size}|${colorKey(node.color)}`;
    strokes.thin.context = this.leases.acquire(
      node.sample,
      `${keyBase}|${strokes.thinWidth}`,
      draw(strokes.thinWidth),
    );
    if (strokes.varying) {
      strokes.thick.context = this.leases.acquire(
        node.sample,
        `${keyBase}|${layout.strokeMax}`,
        draw(layout.strokeMax),
      );
    }
  }

  protected animate(timeMs: number, size: number): void {
    const { node, view } = this;
    const frame = node.sample(loopProgress(timeMs, node.durationMs, node.phase ?? 0), size);
    view.position.set(frame.cx, frame.cy);
    view.scale.set(frame.r / this.rMax);
    this.strokes.setOpacity(frame.opacity, frame.strokeWidth);
  }
}

class PathSceneNode extends SizedSceneNode {
  readonly view = new Container();
  private readonly strokes = new StrokePair();

  constructor(
    private readonly node: PathNode,
    leases: Leases,
  ) {
    super(leases);
    this.view.addChild(this.strokes.thin, this.strokes.thick);
  }

  protected build(size: number): void {
    const { node, strokes } = this;
    const layout = derivePathLayout(sampleLoop(node.sample, size, node.durationMs));
    strokes.setLayout(layout.strokeMin, layout.strokeMax);
    const thinWidth = strokes.thinWidth;
    strokes.thin.context = this.leases.acquire(node.art, `${size}|${thinWidth}`, (context) =>
      node.art(context, thinWidth, size),
    );
    if (strokes.varying) {
      strokes.thick.context = this.leases.acquire(
        node.art,
        `${size}|${layout.strokeMax}`,
        (context) => node.art(context, layout.strokeMax, size),
      );
    }
  }

  protected animate(timeMs: number, size: number): void {
    const { node } = this;
    const frame = node.sample(loopProgress(timeMs, node.durationMs, node.phase ?? 0), size);
    this.strokes.setOpacity(frame.opacity, frame.strokeWidth);
  }
}

interface MorphShape {
  sample: MorphSampler;
  durationMs: number;
  phase: number;
  variantCount: number;
  mode: MorphMode;
  cyclesPerLoop: number;
  art: MorphArt;
}

/** Morph and dash flow: static variants whose opacities follow windows around their phase. */
class MorphSceneNode extends SizedSceneNode {
  readonly view = new Container();
  private readonly variants: Graphics[];

  constructor(
    private readonly shape: MorphShape,
    leases: Leases,
  ) {
    super(leases);
    assertMorphShape(shape.variantCount, shape.cyclesPerLoop);
    this.variants = Array.from({ length: shape.variantCount }, () => new Graphics());
    this.view.addChild(...this.variants);
  }

  protected build(size: number): void {
    const { art } = this.shape;
    this.variants.forEach((variant, k) => {
      variant.context = this.leases.acquire(art, `${size}|${k}`, (context) =>
        art(context, k, size),
      );
    });
  }

  protected animate(timeMs: number, size: number): void {
    const { sample, durationMs, phase, variantCount, mode, cyclesPerLoop } = this.shape;
    const t = loopProgress(timeMs, durationMs, phase);
    const base = sample(t, size).opacity;
    const cyclePhase = (t * cyclesPerLoop) % 1;
    for (let k = 0; k < variantCount; k += 1) {
      this.variants[k]!.alpha = clampOpacity(
        base * windowWeight(cyclePhase, k, variantCount, mode),
      );
    }
  }
}

function morphShape(node: MorphNode): MorphShape {
  return {
    sample: node.sample,
    durationMs: node.durationMs,
    phase: node.phase ?? 0,
    variantCount: node.variantCount,
    mode: node.mode,
    cyclesPerLoop: node.cyclesPerLoop ?? 1,
    art: node.art,
  };
}

/** Dash-flow variant art per node, so the geometry cache keys on a stable function. */
const dashArts = new WeakMap<DashFlowNode, MorphArt>();

function dashFlowShape(node: DashFlowNode): MorphShape {
  const variantCount = node.variantCount ?? DEFAULT_DASH_VARIANTS;
  let art = dashArts.get(node);
  if (!art) {
    art = (context, k, size) =>
      node.art(context, dashFlowOffset(k, variantCount, node.dashPeriod), size);
    dashArts.set(node, art);
  }
  return {
    sample: node.sample ?? opaqueSampler,
    durationMs: node.durationMs,
    phase: node.phase ?? 0,
    variantCount,
    mode: 'stacked',
    cyclesPerLoop: dashFlowCycles(node.dashPeriod, node.travel),
    art,
  };
}

class StaticSceneNode extends SizedSceneNode {
  readonly view = new Graphics();

  constructor(
    private readonly node: StaticNode,
    leases: Leases,
  ) {
    super(leases);
  }

  protected build(size: number): void {
    const { art } = this.node;
    this.view.context = this.leases.acquire(art, `${size}`, (context) => art(context, size));
  }

  protected animate(): void {}
}

class SvgSceneNode extends SizedSceneNode {
  readonly view = new Sprite();
  private entry: TextureEntry | null = null;

  constructor(
    private readonly node: SvgNode,
    private readonly context: NodeContext,
    private readonly decorationId: string,
  ) {
    super(context.leases);
  }

  protected build(size: number): void {
    this.releaseTexture();
    const { textures, resolution, onError } = this.context;
    const entry = textures.acquire(this.node.art, size, resolution);
    this.entry = entry;
    this.view.texture = entry.loaded ?? Texture.EMPTY;
    if (entry.loaded) return;
    entry.texture.then(
      (texture) => {
        if (this.entry === entry) this.view.texture = texture;
      },
      (error: unknown) => {
        onError(
          new Error(`Scene artwork of "${this.decorationId}" failed to rasterise`, {
            cause: error,
          }),
        );
      },
    );
  }

  protected animate(): void {}

  override ready(): boolean {
    return this.entry?.loaded != null;
  }

  override release(): void {
    super.release();
    this.releaseTexture();
  }

  private releaseTexture(): void {
    if (!this.entry) return;
    this.view.texture = Texture.EMPTY;
    this.context.textures.release(this.node.art, this.entry);
    this.entry = null;
  }
}

/** Shared by layers and groups: optional art plus nested nodes under one container. */
abstract class ContainerSceneNode extends SizedSceneNode {
  readonly view = new Container();
  private readonly artView: Graphics | null;

  constructor(
    private readonly art: ((context: GraphicsContext, size: number) => void) | undefined,
    private readonly children: readonly SceneNode[],
    leases: Leases,
  ) {
    super(leases);
    this.artView = art ? new Graphics() : null;
    if (this.artView) this.view.addChild(this.artView);
    for (const child of children) this.view.addChild(child.view);
  }

  protected build(size: number): void {
    const { art, artView } = this;
    if (art && artView) {
      artView.context = this.leases.acquire(art, `${size}`, (context) => art(context, size));
    }
  }

  protected animate(timeMs: number, size: number): void {
    for (const child of this.children) child.update(timeMs, size);
  }

  override ready(): boolean {
    return this.children.every((child) => child.ready());
  }

  override release(): void {
    super.release();
    for (const child of this.children) child.release();
  }
}

class LayerSceneNode extends ContainerSceneNode {
  constructor(
    private readonly node: LayerNode,
    children: readonly SceneNode[],
    leases: Leases,
  ) {
    super(node.art, children, leases);
  }

  protected override build(size: number): void {
    super.build(size);
    const box = this.node.box?.(size);
    this.view.pivot.set(box ? box.width / 2 : 0, box ? box.height / 2 : 0);
  }

  protected override animate(timeMs: number, size: number): void {
    const { node, view } = this;
    const frame = node.sample(loopProgress(timeMs, node.durationMs, node.phase ?? 0), size);
    view.position.set(frame.x, frame.y);
    view.rotation = frame.rotateDeg * DEG_TO_RAD;
    view.scale.set(frame.scaleX, frame.scaleY);
    view.alpha = clampOpacity(frame.opacity);
    super.animate(timeMs, size);
  }
}

class GroupSceneNode extends ContainerSceneNode {
  private readonly mask: Graphics | null;

  constructor(
    private readonly node: GroupNode,
    children: readonly SceneNode[],
    leases: Leases,
  ) {
    super(undefined, children, leases);
    this.mask = node.clip ? new Graphics() : null;
    if (this.mask) {
      this.view.addChild(this.mask);
      this.view.mask = this.mask;
    }
  }

  protected override build(size: number): void {
    const place = this.node.place(size);
    this.view.pivot.set(place.width / 2, place.height / 2);
    this.view.position.set(place.left + place.width / 2, place.top + place.height / 2);
    this.view.scale.set(place.scaleX, place.scaleY);
    this.mask?.clear().rect(0, 0, place.width, place.height).fill(0xffffff);
  }
}

class MountedDecoration implements DecorationHandle {
  readonly container = new Container();
  private size = 0;
  /** Ticker time of the first frame; loops start there, as CSS animations started on mount. */
  private startMs: number | null = null;

  constructor(
    private readonly stage: SceneStage,
    private readonly nodes: readonly SceneNode[],
    private readonly resolution: number,
  ) {
    for (const node of nodes) this.container.addChild(node.view);
    // Hidden until sampled: a resize renders the stage outside the ticker.
    this.container.visible = false;
  }

  setRect(rect: SeatRect): void {
    // On the device-pixel grid, so rasterised artwork maps texel to pixel.
    const { resolution } = this;
    this.container.position.set(
      Math.round(rect.x * resolution) / resolution,
      Math.round(rect.y * resolution) / resolution,
    );
    this.size = rect.size;
  }

  update(timeMs: number): void {
    if (this.size === 0) return;
    this.startMs ??= timeMs;
    const elapsedMs = timeMs - this.startMs;
    for (const node of this.nodes) node.update(elapsedMs, this.size);
    this.container.visible = this.nodes.every((node) => node.ready());
  }

  destroy(): void {
    this.stage.unmount(this);
    for (const node of this.nodes) node.release();
    this.container.destroy({ children: true });
  }
}

class SceneStage {
  private readonly decorations = new Set<MountedDecoration>();
  private readonly contexts = new ContextCache();
  private readonly textures = new TextureCache();
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

  /**
   * Mounts `spec`. `onError` receives failures found after mounting (artwork that does not
   * rasterise); the caller surfaces them instead of showing a partial decoration.
   */
  mount(spec: DecorationSpec, onError: (error: Error) => void): DecorationHandle {
    const resolution = this.application.renderer.resolution;
    const createNode = (node: DecorationNode): SceneNode =>
      this.createNode(node, spec.id, {
        leases: new Leases(this.contexts),
        textures: this.textures,
        resolution,
        onError,
      });
    const decoration = new MountedDecoration(this, spec.nodes.map(createNode), resolution);
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

  private createNode(node: DecorationNode, decorationId: string, context: NodeContext): SceneNode {
    const { leases } = context;
    const createChild = (child: DecorationNode) =>
      this.createNode(child, decorationId, { ...context, leases: new Leases(this.contexts) });
    switch (node.kind) {
      case 'dot':
        return new DotSceneNode(node, this.dotTexture);
      case 'line':
        return new LineSceneNode(node, leases);
      case 'ring':
        return new RingSceneNode(node, leases, context.resolution);
      case 'path':
        return new PathSceneNode(node, leases);
      case 'morph':
        return new MorphSceneNode(morphShape(node), leases);
      case 'dashFlow':
        return new MorphSceneNode(dashFlowShape(node), leases);
      case 'static':
        return new StaticSceneNode(node, leases);
      case 'svg':
        return new SvgSceneNode(node, context, decorationId);
      case 'layer':
        return new LayerSceneNode(node, (node.children ?? []).map(createChild), leases);
      case 'group':
        return new GroupSceneNode(node, node.children.map(createChild), leases);
    }
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
  // Mipmapped: most dots are drawn at a few pixels, far below the texture size.
  const dotTexture = application.renderer.generateTexture({
    target: dot,
    textureSourceOptions: { autoGenerateMipmaps: true },
  });
  dot.destroy();

  return new SceneStage(application, dotTexture);
}
