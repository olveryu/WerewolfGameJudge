/** Builds the seat confirmation model from the shared seat controller. */

import type { RoomSeatController } from '../controllers/useRoomSeatController';
import type { RoomSeatConfirmationModel } from './RoomSeatConfirmation';

/**
 * The single projection from the seat controller's pending take/move
 * action to the shell's confirmation model. Returns null when no action
 * is pending. All seven games previously inlined this four-field mapping.
 */
export function createRoomSeatConfirmationModel(
  controller: RoomSeatController,
): RoomSeatConfirmationModel | null {
  if (controller.pendingAction === null) return null;
  return {
    action: controller.pendingAction,
    isSubmitting: controller.isSubmitting,
    onConfirm: controller.confirm,
    onCancel: controller.cancel,
  };
}
