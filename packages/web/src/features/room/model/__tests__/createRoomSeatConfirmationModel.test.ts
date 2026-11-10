import type { RoomSeatController } from '../../controllers/useRoomSeatController';
import { createRoomSeatConfirmationModel } from '../createRoomSeatConfirmationModel';

function controller(overrides: Partial<RoomSeatController> = {}): RoomSeatController {
  return {
    pendingAction: null,
    isSubmitting: false,
    requestTakeSeat: vi.fn(),
    requestMoveSeat: vi.fn(),
    confirm: vi.fn(async () => undefined),
    cancel: vi.fn(),
    ...overrides,
  };
}

describe('createRoomSeatConfirmationModel', () => {
  it('returns null when no action is pending', () => {
    expect(createRoomSeatConfirmationModel(controller())).toBeNull();
  });

  it('projects the pending action and callbacks verbatim', () => {
    const confirm = vi.fn(async () => undefined);
    const cancel = vi.fn();
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
