import { render, screen } from '@testing-library/react';

import { SeatDot } from '@/components/SeatDot';

describe('SeatDot', () => {
  it('renders the 1-based seat number with the plain base look by default', () => {
    render(<SeatDot seat={2} testId="dot" />);

    const dot = screen.getByTestId('dot');
    expect(screen.getByRole('img', { name: '3号' })).toBe(dot);
    expect(dot).toHaveTextContent('3');
    expect(dot).toHaveAttribute('data-size', 'md');
    expect(dot).toHaveAttribute('data-withdrawn', 'false');
  });

  it('shrinks to the badge size when size is sm', () => {
    render(<SeatDot seat={0} size="sm" testId="dot" />);

    expect(screen.getByTestId('dot')).toHaveAttribute('data-size', 'sm');
    expect(screen.getByTestId('dot')).toHaveTextContent('1');
  });

  it('dims and strikes the number through when withdrawn, naming the state', () => {
    render(<SeatDot seat={2} withdrawn stateLabel="已退水" testId="dot" />);

    const dot = screen.getByRole('img', { name: '3号，已退水' });
    expect(dot).toHaveAttribute('data-withdrawn', 'true');
  });
});
