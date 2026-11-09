/** RoleChip and Section: press toggles, long press opens the role info, sections hold chips. */
import { fireEvent, render, screen } from '@testing-library/react';

import { RoleChip } from '@/games/werewolf/screens/ConfigScreen/components/RoleChip';
import { Section } from '@/games/werewolf/screens/ConfigScreen/components/Section';
import { TESTIDS } from '@/testids';

describe('RoleChip', () => {
  it('renders its label and selected state', () => {
    render(<RoleChip id="seer" label="预言家" selected onToggle={vi.fn()} faction="god" />);

    expect(screen.getByTestId(TESTIDS.configRoleChip('seer'))).toHaveTextContent('预言家');
    expect(screen.getByTestId(TESTIDS.configRoleChip('seer'))).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('calls onToggle with its id when pressed', () => {
    const onToggle = vi.fn<(id: string) => void>();
    render(<RoleChip id="witch" label="女巫" selected={false} onToggle={onToggle} faction="god" />);

    fireEvent.click(screen.getByTestId(TESTIDS.configRoleChip('witch')));

    expect(onToggle).toHaveBeenCalledWith('witch');
  });

  it('opens the role info on a long press without toggling', () => {
    vi.useFakeTimers();
    try {
      const onToggle = vi.fn<(id: string) => void>();
      const onInfoPress = vi.fn<(id: string) => void>();
      render(
        <RoleChip
          id="wolf2"
          label="狼人"
          selected
          onToggle={onToggle}
          faction="wolf"
          onInfoPress={onInfoPress}
        />,
      );
      const chip = screen.getByTestId(TESTIDS.configRoleChip('wolf2'));

      fireEvent.pointerDown(chip);
      vi.advanceTimersByTime(600);
      fireEvent.pointerUp(chip);
      fireEvent.click(chip);

      expect(onInfoPress).toHaveBeenCalledWith('wolf2');
      expect(onToggle).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('Section', () => {
  it('renders its title and chips', () => {
    render(
      <Section title="神职">
        <RoleChip id="seer" label="预言家" selected onToggle={vi.fn()} faction="god" />
      </Section>,
    );

    expect(screen.getByRole('heading', { name: '神职' })).toBeInTheDocument();
    expect(screen.getByText('预言家')).toBeInTheDocument();
  });
});
