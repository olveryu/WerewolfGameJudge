/**
 * frameViewBox — the shared avatar-frame coordinate contract.
 *
 * Every frame SVG uses `viewBox="-8 -8 116 116"`: the avatar occupies 0–100 and artwork may
 * overflow 8 units on each side. `FrameOverlay` sizes the SVG to `avatarSize * 116 / 100`.
 */
export const FRAME_VIEWBOX_PAD = 8;
export const FRAME_VIEWBOX_SIZE = 100 + FRAME_VIEWBOX_PAD * 2;
export const FRAME_VIEWBOX = `${-FRAME_VIEWBOX_PAD} ${-FRAME_VIEWBOX_PAD} ${FRAME_VIEWBOX_SIZE} ${FRAME_VIEWBOX_SIZE}`;

/** Converts a viewBox coordinate to a pixel offset inside a frame SVG of `size` px. */
export function frameUnitsToPx(units: number, size: number): number {
  return ((units + FRAME_VIEWBOX_PAD) * size) / FRAME_VIEWBOX_SIZE;
}
