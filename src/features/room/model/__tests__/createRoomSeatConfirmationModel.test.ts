import type { RoomSeatController } from '../../controllers/useRoomSeatController';
import { createRoomSeatConfirmationModel } from '../createRoomSeatConfirmationModel';

function controller(overrides: Partial<RoomSeatController> = {}): RoomSeatController {
  return {
    pendingAction: null,
    isSubmitting: false,
    requestTakeSeat: jest.fn(),
    requestMoveSeat: jest.fn(),
    confirm: jest.fn(async () => undefined),
    cancel: jest.fn(),
    ...overrides,
  };
}

describe('createRoomSeatConfirmationModel', () => {
  it('returns null when no action is pending', () => {
    expect(createRoomSeatConfirmationModel(controller())).toBeNull();
  });

  it('projects the pending action and callbacks verbatim', () => {
    const confirm = jest.fn(async () => undefined);
    const cancel = jest.fn();
    const model = createRoomSeatConfirmationModel(
      controller({
        pendingAction: { kind: 'move', fromSeat: 1, toSeat: 3 },
        isSubmitting: true,
        confirm,
        cancel,
      }),
    );
    expect(model).toEqual({
      action: { kind: 'move', fromSeat: 1, toSeat: 3 },
      isSubmitting: true,
      onConfirm: confirm,
      onCancel: cancel,
    });
  });
});
