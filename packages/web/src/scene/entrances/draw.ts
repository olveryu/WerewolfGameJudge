/**
 * Immediate-mode drawing for entrance effects: the react-native-svg shapes the previous client
 * animated (circle, ellipse, line, path, view rectangles), redrawn into a `GraphicsContext` every
 * frame with SVG semantics: opacity clamps to `[0, 1]`, empty shapes draw nothing, strokes are
 * centred with SVG's default miter limit, and a zero-length round-capped line is a dot.
 */
import type { GraphicsContext, LineCap, LineJoin } from 'pixi.js';

import { svgPath } from '@/scene/art';
import type { SceneColor } from '@/scene/decoration';

const SVG_MITER_LIMIT = 4;

function visible(opacity: number): number {
  return Math.min(1, Math.max(0, opacity));
}

export interface StrokeOptions {
  color: SceneColor;
  width: number;
  opacity?: number;
  cap?: LineCap;
  join?: LineJoin;
}

function stroke(context: GraphicsContext, options: StrokeOptions, alpha: number): void {
  context.stroke({
    color: options.color,
    width: options.width,
    alpha,
    cap: options.cap ?? 'butt',
    join: options.join ?? 'miter',
    miterLimit: SVG_MITER_LIMIT,
  });
}

export function fillCircle(
  context: GraphicsContext,
  cx: number,
  cy: number,
  r: number,
  color: SceneColor,
  opacity = 1,
): void {
  const alpha = visible(opacity);
  if (r <= 0 || alpha === 0) return;
  context.circle(cx, cy, r).fill({ color, alpha });
}

export function strokeCircle(
  context: GraphicsContext,
  cx: number,
  cy: number,
  r: number,
  options: StrokeOptions,
): void {
  const alpha = visible(options.opacity ?? 1);
  if (r <= 0 || alpha === 0 || options.width <= 0) return;
  context.circle(cx, cy, r);
  stroke(context, options, alpha);
}

export function fillEllipse(
  context: GraphicsContext,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  color: SceneColor,
  opacity = 1,
): void {
  const alpha = visible(opacity);
  if (rx <= 0 || ry <= 0 || alpha === 0) return;
  context.ellipse(cx, cy, rx, ry).fill({ color, alpha });
}

export function strokeEllipse(
  context: GraphicsContext,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  options: StrokeOptions,
): void {
  const alpha = visible(options.opacity ?? 1);
  if (rx <= 0 || ry <= 0 || alpha === 0 || options.width <= 0) return;
  context.ellipse(cx, cy, rx, ry);
  stroke(context, options, alpha);
}

export function strokeLine(
  context: GraphicsContext,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options: StrokeOptions,
): void {
  const alpha = visible(options.opacity ?? 1);
  if (alpha === 0 || options.width <= 0) return;
  if (x1 === x2 && y1 === y2) {
    if (options.cap === 'round') {
      context.circle(x1, y1, options.width / 2).fill({ color: options.color, alpha });
    }
    return;
  }
  context.moveTo(x1, y1).lineTo(x2, y2);
  stroke(context, options, alpha);
}

/** Strokes the arc of `r` about `(cx, cy)` from `startAngle` clockwise through `sweep` radians. */
export function strokeArc(
  context: GraphicsContext,
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  sweep: number,
  options: StrokeOptions,
): void {
  const alpha = visible(options.opacity ?? 1);
  if (r <= 0 || sweep <= 0 || alpha === 0) return;
  context
    .moveTo(cx + Math.cos(startAngle) * r, cy + Math.sin(startAngle) * r)
    .arc(cx, cy, r, startAngle, startAngle + sweep);
  stroke(context, options, alpha);
}

export function fillPath(
  context: GraphicsContext,
  d: string,
  color: SceneColor,
  opacity = 1,
): void {
  const alpha = visible(opacity);
  if (alpha === 0) return;
  context.path(svgPath(d)).fill({ color, alpha });
}

export function strokePath(context: GraphicsContext, d: string, options: StrokeOptions): void {
  const alpha = visible(options.opacity ?? 1);
  if (alpha === 0 || options.width <= 0) return;
  context.path(svgPath(d));
  stroke(context, options, alpha);
}

/** A filled rectangle (an RN view background), optionally rounded. */
export function fillRect(
  context: GraphicsContext,
  x: number,
  y: number,
  width: number,
  height: number,
  color: SceneColor,
  opacity = 1,
  radius = 0,
): void {
  const alpha = visible(opacity);
  if (width <= 0 || height <= 0 || alpha === 0) return;
  context.roundRect(x, y, width, height, radius).fill({ color, alpha });
}
