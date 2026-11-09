/**
 * Avatar frame geometry, unchanged from the previous client: every frame is authored in the
 * viewBox `-8 -8 116 116`, where the framed avatar occupies 0–100 and artwork may overflow 8
 * units on each side. A frame decoration uses the `avatarFrame` anchor, so its `size` is the
 * whole viewBox box and the previous client's loop samplers port verbatim.
 */
import type { GraphicsContext } from 'pixi.js';

const FRAME_VIEWBOX_PAD = 8;
export const FRAME_VIEWBOX_SIZE = 100 + FRAME_VIEWBOX_PAD * 2;
export const FRAME_VIEWBOX = [
  -FRAME_VIEWBOX_PAD,
  -FRAME_VIEWBOX_PAD,
  FRAME_VIEWBOX_SIZE,
  FRAME_VIEWBOX_SIZE,
] as const;

/** Corner radius of a framed seat's avatar in CSS px (`--radius-large`). */
const FRAMED_AVATAR_RADIUS = 20;

/** Converts a viewBox coordinate to a pixel offset inside a frame box of `size` px. */
export function frameUnitsToPx(units: number, size: number): number {
  return ((units + FRAME_VIEWBOX_PAD) * size) / FRAME_VIEWBOX_SIZE;
}

/** The avatar's corner radius in viewBox units for a frame box of `size` px. */
export function frameRx(size: number): number {
  const avatarSize = (size * 100) / FRAME_VIEWBOX_SIZE;
  return (FRAMED_AVATAR_RADIUS * 100) / avatarSize;
}

/**
 * Maps the frame viewBox onto `size` pixels for the shapes drawn after it. PixiJS does not scale
 * stroke widths, so strokes authored in viewBox units are multiplied by the returned unit.
 */
export function applyFrameViewBox(context: GraphicsContext, size: number): number {
  const unit = size / FRAME_VIEWBOX_SIZE;
  context.setTransform(unit, 0, 0, unit, FRAME_VIEWBOX_PAD * unit, FRAME_VIEWBOX_PAD * unit);
  return unit;
}
