/**
 * Scene stage: the single PixiJS application behind every animated decoration
 * (docs/web-client-rewrite.md §5.3).
 *
 * - One WebGL context for the whole app, created on first use. WebGL is required: when it is
 *   unavailable `init` rejects and the caller surfaces the failure; there is no degraded mode.
 * - The ticker runs only while decorations are mounted on an attached host, or an overlay (the
 *   role reveal) borrows the canvas, and the page is visible; otherwise no frames are produced.
 *   Its frame cap is the user's 60 / 30 setting.
 * - Decorations are sampled every frame from their pure samplers; React never re-renders for
 *   motion. Display objects and geometry are built when a decoration mounts or its tile size
 *   changes; the per-frame path only writes transforms and alphas. Geometry is shared through
 *   a ref-counted cache, so seats showing the same decoration at the same size share it.
 * - SVG artwork is rasterised into textures (see `svgTexture.ts`), shared the same way and
 *   destroyed with their last user, so leaving the room frees them. A decoration stays hidden
 *   until all of its textures are ready; a failed rasterisation goes to the mount's `onError`.
 */
import 'pixi.js/browser';

import {
  Application,
  Color,
  Container,
  Graphics,
  GraphicsContext,
  ImageSource,
  Sprite,
  Texture,
} from 'pixi.js';

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
import type { EntranceSpec } from '@/scene/entrance';
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
import {
  type EntranceCallbacks,
  type EntranceHandle,
  type EntranceHost,
  MountedEntrance,
} from '@/scene/stageEntrance';
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
  /** Hides the decoration; it restarts from its first frame when shown again (a remount). */
  setSuspended(suspended: boolean): void;
  /** Dims the whole decoration, as the DOM dims a locked picker cell. */
  setOpacity(opacity: number): void;
  destroy(): void;
}

/** Entrances draw under every resident decoration, as the old tile drew frames over them. */
const ENTRANCE_Z_INDEX = 0;
const RESIDENT_Z_INDEX = 1;

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
  /** A tint drops the colour's own alpha (`rgba(…)`), so it multiplies the opacity instead. */
  private readonly colorAlpha: number;

  constructor(
    private readonly node: DotNode,
    texture: Texture,
  ) {
    const color = new Color(node.color);
    this.colorAlpha = color.alpha;
    this.view = new Sprite({ texture, anchor: 0.5, tint: color.toNumber() });
  }

  update(timeMs: number, size: number): void {
    const { node, view } = this;
    const frame = node.sample(loopProgress(timeMs, node.durationMs, node.phase ?? 0), size);
    view.position.set(frame.cx, frame.cy);
    view.scale.set(frame.r / DOT_TEXTURE_RADIUS);
    view.alpha = clampOpacity(frame.opacity) * this.colorAlpha;
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
  readonly container = new Container({ zIndex: RESIDENT_Z_INDEX });
  private size = 0;
  /** Ticker time of the first frame; loops start there, as CSS animations started on mount. */
  private startMs: number | null = null;
  private suspended = false;

  constructor(
    private readonly stage: SceneStage,
    private readonly nodes: readonly SceneNode[],
    private readonly resolution: number,
  ) {
    for (const node of nodes) this.container.addChild(node.view);
    // Hidden until sampled: a resize renders the stage outside the ticker.
    this.container.visible = false;
  }

  setSuspended(suspended: boolean): void {
    if (suspended === this.suspended) return;
    this.suspended = suspended;
    this.startMs = null;
    this.container.visible = false;
  }

  setOpacity(opacity: number): void {
    this.container.alpha = clampOpacity(opacity);
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
    if (this.size === 0 || this.suspended) return;
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

/**
 * Loads a same-origin image as a white mask texture (its alpha kept, colour dropped), so a tint
 * paints it flat, as CSS `mask-image` over a background colour does.
 */
async function loadMaskTexture(url: string): Promise<Texture> {
  const image = new Image();
  image.src = url;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('Canvas 2D is unavailable for mask textures');
  }
  context.drawImage(image, 0, 0);
  context.globalCompositeOperation = 'source-in';
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  return new Texture({
    source: new ImageSource({
      resource: canvas,
      alphaMode: 'premultiply-alpha-on-upload',
      // Mipmapped: the mark is drawn far below its source size.
      autoGenerateMipmaps: true,
    }),
  });
}

/** A full-screen overlay borrowing the canvas (the role reveal, the gacha machine). */
interface StageOverlay {
  readonly host: HTMLElement;
  readonly root: Container;
  readonly frame: (timeMs: number) => void;
  /** False while the overlay shows a still frame: the ticker may stop. */
  animating: boolean;
}

class SceneStage implements EntranceHost {
  private readonly decorations = new Set<MountedDecoration>();
  private readonly entrances = new Set<MountedEntrance>();
  private readonly animatingEntrances = new Set<MountedEntrance>();
  private readonly maskTextures = new Map<string, Promise<Texture>>();
  private readonly contexts = new ContextCache();
  private readonly textures = new TextureCache();
  /** Parent of the host layers; an overlay hides it. */
  private readonly seatLayer = new Container();
  /** Seat decorations and entrances per host, each in its host's coordinates. */
  private readonly hostLayers = new Map<HTMLElement, Container>();
  private readonly attachedHosts = new Set<HTMLElement>();
  private host: HTMLElement | null = null;
  private overlay: StageOverlay | null = null;
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    private readonly application: Application,
    private readonly dotTexture: Texture,
  ) {
    application.stage.addChild(this.seatLayer);
    application.ticker.add(() => {
      const timeMs = application.ticker.lastTime;
      for (const entrance of this.animatingEntrances) entrance.update(timeMs);
      for (const decoration of this.decorations) decoration.update(timeMs);
      this.overlay?.frame(timeMs);
    });
    document.addEventListener('visibilitychange', () => this.syncTicker());
  }

  get resolution(): number {
    return this.application.renderer.resolution;
  }

  /**
   * Attaches `host`. The canvas covers the attached host last in document order, so a dialog's
   * host (portalled after the page) takes the canvas over the page's and hands it back when it
   * detaches; only that host's decorations are drawn.
   */
  attach(host: HTMLElement): void {
    if (this.attachedHosts.has(host)) {
      throw new Error('Scene stage is already attached to this host');
    }
    this.attachedHosts.add(host);
    this.placeCanvas();
  }

  detach(host: HTMLElement): void {
    if (!this.attachedHosts.delete(host)) {
      throw new Error('Scene stage is not attached to this host');
    }
    this.releaseLayer(host);
    this.placeCanvas();
  }

  /** The layer of `host`'s decorations, created on first use (before or after it attaches). */
  private layerFor(host: HTMLElement): Container {
    let layer = this.hostLayers.get(host);
    if (!layer) {
      layer = new Container({ sortableChildren: true, visible: host === this.host });
      this.hostLayers.set(host, layer);
      this.seatLayer.addChild(layer);
    }
    return layer;
  }

  /** Drops `host`'s layer once it is detached and empty. */
  private releaseLayer(host: HTMLElement): void {
    const layer = this.hostLayers.get(host);
    if (!layer || this.attachedHosts.has(host) || layer.children.length > 0) return;
    this.hostLayers.delete(host);
    layer.destroy();
  }

  /** The attached host last in document order. */
  private topHost(): HTMLElement | null {
    let top: HTMLElement | null = null;
    for (const host of this.attachedHosts) {
      if (top === null || top.compareDocumentPosition(host) & Node.DOCUMENT_POSITION_FOLLOWING) {
        top = host;
      }
    }
    return top;
  }

  /** A root container for `mountOverlay`, built here so overlay chunks import no PixiJS values. */
  createOverlayRoot(): Container {
    return new Container({ sortableChildren: true });
  }

  /**
   * Lends the canvas to a full-screen overlay above the dialog backdrop: moves it into `host`,
   * hides the seat layer and calls `frame` with the ticker time every frame until the returned
   * release runs, which hands the canvas back to the seat board. One overlay at a time.
   */
  mountOverlay(host: HTMLElement, root: Container, frame: (timeMs: number) => void): () => void {
    if (this.overlay) {
      throw new Error('Scene stage already shows an overlay');
    }
    const overlay: StageOverlay = { host, root, frame, animating: true };
    this.overlay = overlay;
    this.seatLayer.visible = false;
    this.application.stage.addChild(root);
    this.placeCanvas();
    return () => {
      if (this.overlay !== overlay) {
        throw new Error('Scene stage overlay was already released');
      }
      this.overlay = null;
      this.application.stage.removeChild(root);
      this.seatLayer.visible = true;
      this.placeCanvas();
    };
  }

  /**
   * Pauses or resumes the mounted overlay's frame loop. Pausing draws one last frame, so a still
   * overlay (an idle machine) costs no ticker work until it animates again.
   */
  setOverlayAnimating(root: Container, animating: boolean): void {
    const overlay = this.overlay;
    if (overlay?.root !== root) {
      throw new Error('Scene stage overlay is not mounted');
    }
    overlay.animating = animating;
    this.syncTicker();
    if (!animating) {
      overlay.frame(this.application.ticker.lastTime);
      this.application.render();
    }
  }

  /** Puts the canvas in the overlay host, else the top host, sized to it. */
  private placeCanvas(): void {
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    this.host = this.topHost();
    for (const [host, layer] of this.hostLayers) layer.visible = host === this.host;
    const target = this.overlay?.host ?? this.host;
    if (target) {
      target.append(this.application.canvas);
      this.application.resizeTo = target;
      this.resizeObserver = new ResizeObserver(() => {
        this.application.resize();
        // A stopped ticker renders nothing on its own; redraw the still frame at the new size.
        if (!this.application.ticker.started) this.application.render();
      });
      this.resizeObserver.observe(target);
    } else {
      this.application.canvas.remove();
    }
    this.syncTicker();
  }

  setFrameRate(frameRate: SceneFrameRate): void {
    this.application.ticker.maxFPS = frameRate;
  }

  /**
   * Mounts `spec`. `onError` receives failures found after mounting (artwork that does not
   * rasterise); the caller surfaces them instead of showing a partial decoration.
   */
  mount(
    spec: DecorationSpec,
    host: HTMLElement,
    onError: (error: Error) => void,
  ): DecorationHandle {
    const resolution = this.application.renderer.resolution;
    const createNode = (node: DecorationNode): SceneNode =>
      this.createNode(node, spec.id, {
        leases: new Leases(this.contexts),
        textures: this.textures,
        resolution,
        onError,
      });
    const decoration = new MountedDecoration(this, spec.nodes.map(createNode), resolution);
    this.layerFor(host).addChild(decoration.container);
    this.decorations.add(decoration);
    this.syncTicker();
    return decoration;
  }

  unmount(decoration: MountedDecoration | MountedEntrance): void {
    const layer = decoration.container.parent;
    decoration.container.removeFromParent();
    for (const [host, hostLayer] of this.hostLayers) {
      if (hostLayer === layer) this.releaseLayer(host);
    }
    if (decoration instanceof MountedEntrance) {
      this.entrances.delete(decoration);
      this.animatingEntrances.delete(decoration);
    } else {
      this.decorations.delete(decoration);
    }
    this.syncTicker();
  }

  /**
   * Mounts a seat entrance, idle until `play()`. `callbacks.onError` receives failures found
   * after mounting; the caller surfaces them.
   */
  mountEntrance(
    spec: EntranceSpec,
    host: HTMLElement,
    callbacks: EntranceCallbacks,
  ): EntranceHandle {
    const entrance = new MountedEntrance(spec, callbacks, this);
    entrance.container.zIndex = ENTRANCE_Z_INDEX;
    this.layerFor(host).addChild(entrance.container);
    this.entrances.add(entrance);
    return entrance;
  }

  setAnimating(entrance: MountedEntrance, animating: boolean): void {
    if (!this.entrances.has(entrance)) {
      throw new Error('Scene entrance is not mounted on this stage');
    }
    if (animating) this.animatingEntrances.add(entrance);
    else this.animatingEntrances.delete(entrance);
    this.syncTicker();
  }

  loadMaskTexture(url: string): Promise<Texture> {
    let texture = this.maskTextures.get(url);
    if (!texture) {
      texture = loadMaskTexture(url);
      this.maskTextures.set(url, texture);
    }
    return texture;
  }

  private syncTicker(): void {
    const hasSeatWork =
      this.host !== null && (this.decorations.size > 0 || this.animatingEntrances.size > 0);
    const shouldRun = (hasSeatWork || this.overlay?.animating === true) && !document.hidden;
    const ticker = this.application.ticker;
    if (shouldRun && !ticker.started) ticker.start();
    if (!shouldRun && ticker.started) {
      ticker.stop();
      // A stopped ticker keeps its last frame on the canvas: draw the stage as it is now, so a
      // decoration unmounted since that frame (its tile scrolled out of view) does not linger.
      if (!document.hidden) this.application.render();
    }
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

let sharedStage: Promise<SceneStage> | null = null;

/**
 * The app-wide stage, created on first call. Scene components reach it through
 * `sceneStagePromise()`; overlays call it directly.
 *
 * @returns the same promise on every call; rejects when WebGL is unavailable
 */
export function sharedSceneStage(): Promise<SceneStage> {
  sharedStage ??= createSceneStage();
  return sharedStage;
}

/**
 * Creates a stage. Call through `sharedSceneStage()`, which keeps it app-wide.
 *
 * @returns the stage; rejects when WebGL is unavailable
 */
async function createSceneStage(): Promise<SceneStage> {
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
