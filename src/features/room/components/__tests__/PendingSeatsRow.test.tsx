/**
 * PendingSeatsRow.test.tsx
 *
 * Tests for the shared pending-seats row and its text form.
 */
import { render } from '@testing-library/react-native';

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
    const { getByTestId } = render(
      <PendingSeatsRow label="未投票" seats={[1, 3]} testID="pending-seats" />,
    );

    expect(getByTestId('pending-seats-label')).toBeTruthy();
    expect(getByTestId('pending-seats-seat-1')).toBeTruthy();
    expect(getByTestId('pending-seats-seat-3')).toBeTruthy();
  });

  it('renders nothing when no seat is pending', () => {
    const { queryByTestId } = render(
      <PendingSeatsRow label="未投票" seats={[]} testID="pending-seats" />,
    );

    expect(queryByTestId('pending-seats')).toBeNull();
  });
});
