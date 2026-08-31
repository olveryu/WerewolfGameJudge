/** Responsive room-shell layout decisions shared by game screens and the shell renderer. */

export const ROOM_SIDE_INSPECTOR_MIN_WIDTH = 1100;
export const ROOM_SINGLE_ROW_HEADER_MIN_WIDTH = 440;

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

/** Return whether header controls need a separate centered title row. */
export function usesStackedRoomHeader(viewportWidth: number): boolean {
  assertValidViewportWidth(viewportWidth);
  return viewportWidth < ROOM_SINGLE_ROW_HEADER_MIN_WIDTH;
}
