import { fireEvent, render, screen } from '@testing-library/react';

import { ShareReviewModal } from '../ShareReviewModal';

const SEATS = [
  { seat: 1, displayName: '玩家2' },
  { seat: 2, displayName: '玩家3' },
  { seat: 3, displayName: '玩家4' },
];

describe('ShareReviewModal', () => {
  it('seeds the draft from the authorized seats that are offered', () => {
    const onConfirm = vi.fn();
    render(
      <ShareReviewModal
        seats={SEATS}
        currentAllowedSeats={[0, 2]}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('确认（1人）'));

    expect(onConfirm).toHaveBeenCalledWith([2]);
  });

  it('keeps the draft when the parent re-renders with fresh prop references', () => {
    const onConfirm = vi.fn();
    const view = render(
      <ShareReviewModal
        seats={SEATS}
        currentAllowedSeats={[]}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText(/玩家3/));
    fireEvent.click(screen.getByText(/玩家4/));

    // A room snapshot re-render hands down new arrays with the same content.
    view.rerender(
      <ShareReviewModal
        seats={SEATS.map((seat) => ({ ...seat }))}
        currentAllowedSeats={[]}
        onConfirm={onConfirm}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByText('确认（2人）'));

    expect(onConfirm).toHaveBeenCalledWith([2, 3]);
  });
});
