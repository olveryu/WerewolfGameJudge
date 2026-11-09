/** Responsive room-shell layout decisions shared by game screens and the shell renderer. */

export const ROOM_SIDE_INSPECTOR_MIN_WIDTH = 1100;

export type RoomHeaderLayout = 'centered' | 'compact' | 'stacked';

export interface RoomHeaderMeasurements {
  readonly centerContentWidth: number;
  readonly horizontalPaddingWidth: number;
  readonly leadingWidth: number;
  readonly trailingWidth: number;
}

function assertValidViewportWidth(viewportWidth: number): void {
  if (!Number.isFinite(viewportWidth) || viewportWidth <= 0) {
    throw new Error(`Room viewport width must be positive and finite: ${viewportWidth}`);
  }
}

function assertValidMeasurement(measurement: number): void {
  if (!Number.isFinite(measurement) || measurement < 0) {
    throw new Error(`Room header measurement must be non-negative and finite: ${measurement}`);
  }
}

/** Return whether the viewport has enough width for a persistent room inspector. */
export function usesRoomSideInspector(viewportWidth: number): boolean {
  assertValidViewportWidth(viewportWidth);
  return viewportWidth >= ROOM_SIDE_INSPECTOR_MIN_WIDTH;
}

/**
 * Resolve whether the title can remain viewport-centered, must use remaining space, or needs a row.
 * @throws Error when the viewport width or any header measurement is invalid.
 */
export function resolveRoomHeaderLayout(
  viewportWidth: number,
  measurements: RoomHeaderMeasurements,
): RoomHeaderLayout {
  assertValidViewportWidth(viewportWidth);
  assertValidMeasurement(measurements.centerContentWidth);
  assertValidMeasurement(measurements.horizontalPaddingWidth);
  assertValidMeasurement(measurements.leadingWidth);
  assertValidMeasurement(measurements.trailingWidth);

  const singleRowMinimumWidth =
    measurements.horizontalPaddingWidth +
    measurements.leadingWidth +
    measurements.centerContentWidth +
    measurements.trailingWidth;

  if (viewportWidth < singleRowMinimumWidth) return 'stacked';

  const centeredMinimumWidth =
    measurements.horizontalPaddingWidth +
    Math.max(measurements.leadingWidth, measurements.trailingWidth) * 2 +
    measurements.centerContentWidth;

  return viewportWidth < centeredMinimumWidth ? 'compact' : 'centered';
}
