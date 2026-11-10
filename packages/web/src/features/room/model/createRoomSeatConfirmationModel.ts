/** Builds the seat confirmation model from the shared seat controller. */

import type { RoomSeatController } from '../controllers/useRoomSeatController';
import type { RoomSeatConfirmationModel } from './RoomSeatConfirmation';

/** The slice of the seat controller the confirmation projection reads. */
export type RoomSeatConfirmationSource = Pick<
  RoomSeatController,
  'pendingAction' | 'isSubmitting' | 'confirm' | 'cancel'
>;

/**
 * The single projection from the seat controller's pending take/move
 * action to the shell's confirmation model. Returns null when no action
 * is pending. All seven games previously inlined this four-field mapping.
 */
export function createRoomSeatConfirmationModel(
  source: RoomSeatConfirmationSource,
): RoomSeatConfirmationModel | null {
  if (source.pendingAction === null) return null;
  return {
    action: source.pendingAction,
    isSubmitting: source.isSubmitting,
    onConfirm: source.confirm,
    onCancel: source.cancel,
  };
}
