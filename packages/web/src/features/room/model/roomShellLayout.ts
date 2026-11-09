/** Responsive room-shell layout decision shared by game screens and the shell renderer. */

export const ROOM_SIDE_INSPECTOR_MIN_WIDTH = 1100;

function assertValidViewportWidth(viewportWidth: number): void {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) {
    throw new Error(`Room viewport width must be positive and finite: ${viewportWidth}`);
  }
}

/** Return whether the viewport has enough width for a persistent room inspector. */
export function usesRoomSideInspector(viewportWidth: number): boolean {
  assertValidViewportWidth(viewportWidth);
  return viewportWidth >= ROOM_SIDE_INSPECTOR_MIN_WIDTH;
}
