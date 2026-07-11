/** Game-neutral model for take, move, and leave-seat confirmation. */

export type RoomSeatPendingAction =
  | { readonly kind: 'take'; readonly toSeat: number }
  | { readonly kind: 'move'; readonly fromSeat: number; readonly toSeat: number }
  | { readonly kind: 'leave'; readonly fromSeat: number };

export interface RoomSeatConfirmationModel {
  readonly action: RoomSeatPendingAction;
  readonly isSubmitting: boolean;
  readonly onConfirm: () => Promise<void>;
  readonly onCancel: () => void;
}
