import { render } from '@testing-library/react-native';

import { RoomSeatConfirmModal } from '@/features/room/components/RoomSeatConfirmModal';
import { createRoomFeatureStyles } from '@/features/room/components/styles';
import type { RoomSeatConfirmationModel } from '@/features/room/model/RoomSeatConfirmation';
import { colors } from '@/theme';

const styles = createRoomFeatureStyles(colors).seatConfirmModal;

function renderModal(action: RoomSeatConfirmationModel['action']) {
  return render(
    <RoomSeatConfirmModal
      model={{
        action,
        isSubmitting: false,
        onConfirm: async () => undefined,
        onCancel: jest.fn(),
      }}
      styles={styles}
    />,
  );
}

describe('RoomSeatConfirmModal', () => {
  it('renders take and move as distinct user intents', () => {
    const take = renderModal({ kind: 'take', toSeat: 2 });
    expect(take.getByTestId('seat-confirm-title').props.children).toBe('入座');
    expect(take.getByTestId('seat-confirm-message').props.children).toBe('确定在3号位入座？');
    take.unmount();

    const move = renderModal({ kind: 'move', fromSeat: 2, toSeat: 5 });
    expect(move.getByTestId('seat-confirm-title').props.children).toBe('换座');
    expect(move.getByTestId('seat-confirm-message').props.children).toBe('确定从3号位换到6号位？');
  });
});
