/** Tests for the shared pending-seats row and its text form. */
import { render, screen } from '@testing-library/react';

import { formatPendingSeats, PendingSeatsRow } from '@/features/room/components/PendingSeatsRow';

describe('formatPendingSeats', () => {
  it('formats the label and 1-based seat numbers', () => {
    expect(formatPendingSeats('未投票', [1, 3])).toBe('未投票：2号 4号');
  });

  it('returns an empty string when no seat is pending', () => {
    expect(formatPendingSeats('未投票', [])).toBe('');
  });
});

describe('PendingSeatsRow', () => {
  it('renders the label and one dot per pending seat', () => {
    render(<PendingSeatsRow label="未投票" seats={[1, 3]} testId="pending-seats" />);

    expect(screen.getByTestId('pending-seats-label')).toHaveTextContent('未投票：');
    expect(screen.getByTestId('pending-seats-seat-1')).toHaveAccessibleName('2号');
    expect(screen.getByTestId('pending-seats-seat-3')).toHaveAccessibleName('4号');
  });

  it('renders nothing when no seat is pending', () => {
    render(<PendingSeatsRow label="未投票" seats={[]} testId="pending-seats" />);

    expect(screen.queryByTestId('pending-seats')).toBeNull();
  });
});
