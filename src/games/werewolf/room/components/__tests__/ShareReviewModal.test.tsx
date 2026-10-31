import { fireEvent, render } from '@testing-library/react-native';

import { ShareReviewModal } from '../ShareReviewModal';

const SEATS = [
  { seat: 1, displayName: '玩家2' },
  { seat: 2, displayName: '玩家3' },
  { seat: 3, displayName: '玩家4' },
];

describe('ShareReviewModal', () => {
  it('seeds the draft from the authorized seats that are offered', () => {
    const onConfirm = jest.fn();
    const view = render(
      <ShareReviewModal
        seats={SEATS}
        currentAllowedSeats={[0, 2]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />,
    );

    fireEvent.press(view.getByText('确认（1人）'));

    expect(onConfirm).toHaveBeenCalledWith([2]);
  });

  it('keeps the draft when the parent re-renders with fresh prop references', () => {
    const onConfirm = jest.fn();
    const view = render(
      <ShareReviewModal
        seats={SEATS}
        currentAllowedSeats={[]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />,
    );

    fireEvent.press(view.getByText(/玩家3/));
    fireEvent.press(view.getByText(/玩家4/));

    // A room snapshot re-render hands down new arrays with the same content.
    view.rerender(
      <ShareReviewModal
        seats={SEATS.map((seat) => ({ ...seat }))}
        currentAllowedSeats={[]}
        onConfirm={onConfirm}
        onClose={jest.fn()}
      />,
    );

    fireEvent.press(view.getByText('确认（2人）'));

    expect(onConfirm).toHaveBeenCalledWith([2, 3]);
  });
});
