import { render, screen } from '@testing-library/react';

import { FactionChip } from '@/components/FactionChip';

describe('FactionChip', () => {
  it('renders the › affordance only when showChevron is true', () => {
    const { rerender } = render(<FactionChip label="预言家" tone="god" onPress={() => {}} />);
    expect(screen.queryByText('›')).not.toBeInTheDocument();
    rerender(<FactionChip label="预言家" tone="god" onPress={() => {}} showChevron />);
    expect(screen.getByText('›')).toHaveAttribute('aria-hidden', 'true');
  });

  it('renders a span without an action when onPress is omitted', () => {
    render(<FactionChip label="预言家" tone="god" showChevron />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.getByText('›')).toBeInTheDocument();
  });
});
