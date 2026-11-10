/** Room dialog sizing: one width rule shared by the dialog and the review export page. */

const ROOM_DIALOG_MAX_WIDTH = 440;
const ROOM_DIALOG_WIDTH_FRACTION = 0.94;

/**
 * The room dialog's rendered width for a viewport width: a fraction of the
 * viewport, capped. Surfaces that must match a dialog pixel for pixel (the
 * review export page) size from this.
 */
export function resolveRoomDialogWidth(viewportWidth: number): number {
  return Math.min(viewportWidth * ROOM_DIALOG_WIDTH_FRACTION, ROOM_DIALOG_MAX_WIDTH);
}
