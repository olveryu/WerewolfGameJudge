/**
 * Pixi helpers for porting the old Skia layers: Gaussian blur by Skia sigma, gradient fills and
 * canvas-rect clipping.
 */
import { BlurFilter, type Container, FillGradient, Graphics } from 'pixi.js';

/**
 * Pixi's optimized 5-tap blur at quality 4 spreads a Gaussian of 1.2923 CSS px per unit of
 * strength (the passes' kernel variance is 1.67 taps²), so a Skia `<Blur blur={σ}>` maps to
 * strength σ / 1.2923.
 */
const BLUR_SIGMA_PER_STRENGTH = 1.2923;

/** Sets `filter` to a Gaussian of `sigma` CSS px, padded to 3σ so the tails are not cut. */
export function setBlurSigma(filter: BlurFilter, sigma: number): void {
  filter.enabled = sigma > 0;
  if (sigma <= 0) return;
  filter.strength = sigma / BLUR_SIGMA_PER_STRENGTH;
  filter.padding = Math.ceil(sigma * 3);
}

/** A Gaussian blur filter of `sigma` CSS px, as Skia's `<Blur blur={sigma}>`. */
export function blurFilter(sigma: number): BlurFilter {
  const filter = new BlurFilter({ strength: 1 });
  setBlurSigma(filter, sigma);
  return filter;
}

/** Evenly spread stops unless `offsets` are given, as Skia gradients place them. */
function colorStops(colors: readonly string[], offsets?: readonly number[]) {
  return colors.map((color, index) => ({
    offset: offsets?.[index] ?? (colors.length === 1 ? 0 : index / (colors.length - 1)),
    color,
  }));
}

/**
 * Pixi paints a radial gradient's texture over a fill of its last stop, which shows through
 * every translucent inner stop: a vignette's clear center comes out as dark as its rim. These
 * gradients are concentric with a zero inner radius, so the gradient alone covers the texture
 * (clamping past its last stop as Skia does); repaint it without that underlay.
 */
function withoutLastStopUnderlay(gradient: FillGradient): FillGradient {
  gradient.buildGradient();
  const canvas: unknown = gradient.texture.source.resource;
  if (!(canvas instanceof HTMLCanvasElement)) {
    throw new Error('Radial gradient texture is not backed by a canvas');
  }
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Radial gradient canvas has no 2D context');
  const half = canvas.width / 2;
  const fill = context.createRadialGradient(half, half, 0, half, half, half);
  for (const stop of gradient.colorStops) fill.addColorStop(stop.offset, stop.color);
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = fill;
  context.fillRect(0, 0, canvas.width, canvas.height);
  return gradient;
}

/** Skia `<RadialGradient c r colors positions>` in the coordinates the shape is drawn in. */
export function radialGradient(
  cx: number,
  cy: number,
  radius: number,
  colors: readonly string[],
  offsets?: readonly number[],
): FillGradient {
  return withoutLastStopUnderlay(
    new FillGradient({
      type: 'radial',
      center: { x: cx, y: cy },
      innerRadius: 0,
      outerCenter: { x: cx, y: cy },
      outerRadius: radius,
      colorStops: colorStops(colors, offsets),
      textureSpace: 'global',
    }),
  );
}

/** Skia `<LinearGradient start end colors positions>` in the shape's coordinates. */
export function linearGradient(
  start: { readonly x: number; readonly y: number },
  end: { readonly x: number; readonly y: number },
  colors: readonly string[],
  offsets?: readonly number[],
): FillGradient {
  return new FillGradient({
    type: 'linear',
    start,
    end,
    colorStops: colorStops(colors, offsets),
    textureSpace: 'global',
  });
}

/**
 * A radial gradient filling each shape's own bounds (center at its middle, radius half its
 * width), so one gradient serves every circle drawn with it, wherever and however large.
 */
export function shapeRadialGradient(
  colors: readonly string[],
  offsets?: readonly number[],
): FillGradient {
  return withoutLastStopUnderlay(
    new FillGradient({
      type: 'radial',
      center: { x: 0.5, y: 0.5 },
      innerRadius: 0,
      outerCenter: { x: 0.5, y: 0.5 },
      outerRadius: 0.5,
      colorStops: colorStops(colors, offsets),
      textureSpace: 'local',
    }),
  );
}

interface LayerOptions {
  /** Gaussian sigma in CSS px (or a filter to animate), as Skia `<Blur>` or a group layer blur. */
  readonly blur?: number | BlurFilter;
  /** Skia `blendMode="screen"`. */
  readonly screen?: boolean;
}

/**
 * A container for one Skia `<Group>`: opacity is its `alpha`, a blur becomes a filter, and a
 * screen blend applies to the filtered result as Skia blends the group's layer.
 */
export function groupLayer<T extends Container>(
  parent: Container,
  child: T,
  options: LayerOptions = {},
): T {
  const blendMode = options.screen ? 'screen' : 'normal';
  if (options.blur !== undefined) {
    const filter = typeof options.blur === 'number' ? blurFilter(options.blur) : options.blur;
    filter.blendMode = blendMode;
    child.filters = [filter];
  } else {
    child.blendMode = blendMode;
  }
  parent.addChild(child);
  return child;
}

/** A redrawn-per-frame `Graphics` added to `parent` as one Skia group. */
export function graphicsLayer(parent: Container, options: LayerOptions = {}): Graphics {
  return groupLayer(parent, new Graphics(), options);
}

/** Clips `container` to a rectangle, as each old Skia `<Canvas>` clipped to its bounds. */
export function clipToRect(
  container: Container,
  x: number,
  y: number,
  width: number,
  height: number,
): void {
  const previous = container.mask;
  if (previous instanceof Graphics) {
    container.mask = null;
    previous.destroy();
  }
  const mask = new Graphics().rect(x, y, width, height).fill(0xffffff);
  container.addChild(mask);
  container.mask = mask;
}
