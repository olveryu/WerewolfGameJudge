/**
 * A seat entrance on the scene stage: effects redrawn every frame from the spec's pure timeline,
 * the avatar's DOM poses pushed through a callback, and effects "behind" the avatar kept behind
 * it although the canvas lies over the DOM (docs/web-client-rewrite.md §5.3 scheme B): erased
 * under a picture, or painted over by the stage's own copy of a flat avatar mark (see
 * `AvatarCoverage`). Entrances stay mounted between plays, idle and without frames.
 */
import { AlphaFilter, Container, Graphics, GraphicsContext, Sprite, type Texture } from 'pixi.js';

import type {
  AvatarCoverage,
  AvatarPose,
  EntranceGeometry,
  EntranceLayer,
  EntranceSpec,
} from '@/scene/entrance';
import { clampOpacity } from '@/scene/loopGeometry';

const DEG_TO_RAD = Math.PI / 180;

/** Stage services an entrance runs on. */
export interface EntranceHost {
  readonly resolution: number;
  /** Starts or stops producing frames for `entrance`. */
  setAnimating(entrance: MountedEntrance, animating: boolean): void;
  /** A same-origin alpha image as a white mask texture, shared for the stage's lifetime. */
  loadMaskTexture(url: string): Promise<Texture>;
  unmount(entrance: MountedEntrance): void;
}

export interface EntranceCallbacks {
  /**
   * Applies the avatar copies' poses (back to front) to the DOM; called every frame. With
   * `drawnOnStage` the stage paints the avatar itself this frame and the DOM avatar must hide.
   */
  applyAvatar(poses: readonly AvatarPose[], drawnOnStage: boolean): void;
  /** `true` when a play starts, `false` once it reaches the spec's completion time. */
  onActiveChange(active: boolean): void;
  /** A failure the entrance cannot recover from (the avatar mark does not load). */
  onError(error: Error): void;
}

/** Handle for one mounted entrance. */
export interface EntranceHandle {
  setGeometry(geometry: EntranceGeometry): void;
  /** Plays the entrance from its start. */
  play(): void;
  destroy(): void;
}

/** One effect layer: a context redrawn per frame, optionally composited as a group. */
class LayerView {
  readonly context = new GraphicsContext();
  readonly view = new Graphics(this.context);
  private readonly filter: AlphaFilter | null;

  constructor(private readonly layer: EntranceLayer) {
    this.filter =
      typeof layer === 'function'
        ? null
        : new AlphaFilter({ alpha: 1, resolution: 'inherit', antialias: 'inherit' });
    if (this.filter) this.view.filters = [this.filter];
  }

  draw(elapsedMs: number, size: number): void {
    const { layer, context, filter } = this;
    context.clear();
    if (typeof layer === 'function') {
      layer(context, elapsedMs, size);
      return;
    }
    const alpha = clampOpacity(layer.groupOpacity(elapsedMs));
    this.view.visible = alpha > 0;
    if (filter) filter.alpha = alpha;
    if (alpha > 0) layer.draw(context, elapsedMs, size);
  }

  destroy(): void {
    this.filter?.destroy();
    this.view.destroy();
    this.context.destroy();
  }
}

export class MountedEntrance implements EntranceHandle {
  readonly container = new Container();
  private readonly clip = new Graphics();
  private readonly beneath: LayerView | null;
  private readonly above: LayerView | null;
  /** Transformed like the avatar: erases beneath effects under a picture, or paints the mark. */
  private readonly cover = new Container();
  private coverShape: Graphics | Sprite | null = null;
  private coverageKind: AvatarCoverage['kind'] = 'box';
  private coverageKey = '';
  private coverageReady = false;
  private geometry: EntranceGeometry | null = null;
  private playing = false;
  private completed = true;
  /** Ticker time of the play's first frame. */
  private startMs: number | null = null;

  constructor(
    private readonly spec: EntranceSpec,
    private readonly callbacks: EntranceCallbacks,
    private readonly host: EntranceHost,
  ) {
    this.beneath = spec.beneath ? new LayerView(spec.beneath) : null;
    this.above = spec.above ? new LayerView(spec.above) : null;
    this.container.addChild(this.clip);
    this.container.mask = this.clip;
    if (this.beneath) this.container.addChild(this.beneath.view, this.cover);
    if (this.above) this.container.addChild(this.above.view);
    this.container.visible = false;
  }

  setGeometry(geometry: EntranceGeometry): void {
    this.geometry = geometry;
    const { resolution } = this.host;
    this.container.position.set(
      Math.round(geometry.x * resolution) / resolution,
      Math.round(geometry.y * resolution) / resolution,
    );
    const radius = this.spec.clip === 'rounded' ? geometry.cornerRadius : 0;
    this.clip.clear().roundRect(0, 0, geometry.size, geometry.size, radius).fill(0xffffff);
    if (this.beneath) this.setCoverage(geometry.coverage);
  }

  play(): void {
    this.playing = true;
    this.completed = false;
    this.startMs = null;
    this.callbacks.onActiveChange(true);
    this.host.setAnimating(this, true);
  }

  update(timeMs: number): void {
    const { geometry, spec } = this;
    if (!this.playing || geometry === null || (this.beneath && !this.coverageReady)) return;
    this.startMs ??= timeMs;
    const elapsedMs = timeMs - this.startMs;
    if (!this.completed && elapsedMs >= spec.completeMs) {
      this.completed = true;
      this.callbacks.onActiveChange(false);
    }
    const settled = this.completed && elapsedMs >= spec.settleMs;
    this.render(elapsedMs, geometry, settled);
    if (settled) {
      this.playing = false;
      this.host.setAnimating(this, false);
    }
  }

  destroy(): void {
    this.host.unmount(this);
    this.beneath?.destroy();
    this.above?.destroy();
    this.container.destroy({ children: true });
  }

  /** Draws a frame; once `settled`, a painted mark hands the avatar back to the DOM. */
  private render(elapsedMs: number, geometry: EntranceGeometry, settled: boolean): void {
    const { size } = geometry;
    const poses = this.spec.avatar(elapsedMs, size);
    const avatar = poses.at(-1);
    if (!avatar) {
      throw new Error(`Seat entrance "${this.spec.id}" posed no avatar`);
    }
    this.beneath?.draw(elapsedMs, size);
    this.above?.draw(elapsedMs, size);
    const paintsMark = this.beneath !== null && this.coverageKind === 'mark' && !settled;
    if (this.beneath) this.placeCover(avatar, geometry);
    this.cover.visible = this.beneath !== null && (this.coverageKind === 'box' || paintsMark);
    this.container.visible = true;
    this.callbacks.applyAvatar(poses, paintsMark);
  }

  private placeCover(avatar: AvatarPose, geometry: EntranceGeometry): void {
    const { cover } = this;
    cover.pivot.set(geometry.pivotX, geometry.pivotY);
    cover.position.set(geometry.pivotX + avatar.translateX, geometry.pivotY + avatar.translateY);
    cover.rotation = avatar.rotateDeg * DEG_TO_RAD;
    cover.scale.set(avatar.scale * Math.cos(avatar.rotateYDeg * DEG_TO_RAD), avatar.scale);
    cover.alpha = clampOpacity(avatar.opacity);
  }

  private setCoverage(coverage: AvatarCoverage): void {
    const key = JSON.stringify(coverage);
    if (key === this.coverageKey) return;
    this.coverageKey = key;
    this.coverageKind = coverage.kind;
    this.coverShape?.destroy();
    this.coverShape = null;
    if (coverage.kind === 'box') {
      const box = new Graphics()
        .roundRect(coverage.x, coverage.y, coverage.width, coverage.height, coverage.radius)
        .fill(0xffffff);
      box.blendMode = 'erase';
      this.useCoverShape(box);
      return;
    }
    this.coverageReady = false;
    this.host.loadMaskTexture(coverage.url).then(
      (texture) => {
        if (this.coverageKey !== key || this.container.destroyed) return;
        // Fitted like the DOM mark (`mask-size: contain`, centred).
        const fit = Math.min(coverage.width / texture.width, coverage.height / texture.height);
        const mark = new Sprite({ texture, anchor: 0.5, tint: coverage.tint });
        mark.scale.set(fit);
        mark.position.set(coverage.x + coverage.width / 2, coverage.y + coverage.height / 2);
        this.useCoverShape(mark);
      },
      (error: unknown) => {
        this.callbacks.onError(
          new Error(`Avatar mark of seat entrance "${this.spec.id}" failed to load`, {
            cause: error,
          }),
        );
      },
    );
  }

  private useCoverShape(shape: Graphics | Sprite): void {
    this.coverShape = shape;
    this.cover.addChild(shape);
    this.coverageReady = true;
  }
}
