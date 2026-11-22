/** RoleChip and Section: tap toggles, long-press opens the role info, variant chips wear the swap icon. */
import { act, fireEvent, render, screen } from '@testing-library/react';

import { RoleChip } from '@/games/werewolf/screens/ConfigScreen/components/RoleChip';
import { Section } from '@/games/werewolf/screens/ConfigScreen/components/Section';
import { TESTIDS } from '@/testids';

describe('RoleChip', () => {
  it('renders its label and selected state without a badge', () => {
    render(<RoleChip id="seer" label="预言家" selected onToggle={vi.fn()} faction="god" />);

    const chip = screen.getByTestId(TESTIDS.configRoleChip('seer'));
    expect(chip).toHaveTextContent('预言家');
    expect(chip).toHaveAttribute('aria-pressed', 'true');
    expect(chip.closest('.config-role-chip')).toHaveAttribute('data-selected', 'true');
    expect(screen.queryByText('✓')).not.toBeInTheDocument();
    expect(screen.queryByText('＋')).not.toBeInTheDocument();
  });

  it('calls onToggle with its id when the chip is tapped', () => {
    const onToggle = vi.fn<(id: string) => void>();
    const onInfoPress = vi.fn<(id: string) => void>();
    render(
      <RoleChip
        id="witch"
        label="女巫"
        selected={false}
        onToggle={onToggle}
        faction="god"
        onInfoPress={onInfoPress}
      />,
    );

    fireEvent.click(screen.getByTestId(TESTIDS.configRoleChip('witch')));

    expect(onToggle).toHaveBeenCalledWith('witch');
    expect(onInfoPress).not.toHaveBeenCalled();
  });

  it('opens the role info on long-press without toggling', () => {
    const onToggle = vi.fn<(id: string) => void>();
    const onInfoPress = vi.fn<(id: string) => void>();
    render(
      <RoleChip
        id="witch"
        label="女巫"
        selected={false}
        onToggle={onToggle}
        faction="god"
        onInfoPress={onInfoPress}
      />,
    );

    const chip = screen.getByTestId(TESTIDS.configRoleChip('witch'));
    vi.useFakeTimers();
    try {
      fireEvent.pointerDown(chip);
      act(() => {
        vi.advanceTimersByTime(600);
      });
      fireEvent.pointerUp(chip);
      // The browser fires a click after the pointer goes up; it must not toggle.
      fireEvent.click(chip);
    } finally {
      vi.useRealTimers();
    }

    expect(onInfoPress).toHaveBeenCalledWith('witch');
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('does not open the role info on a short press', () => {
    const onToggle = vi.fn<(id: string) => void>();
    const onInfoPress = vi.fn<(id: string) => void>();
    render(
      <RoleChip
        id="witch"
        label="女巫"
        selected={false}
        onToggle={onToggle}
        faction="god"
        onInfoPress={onInfoPress}
      />,
    );

    const chip = screen.getByTestId(TESTIDS.configRoleChip('witch'));
    vi.useFakeTimers();
    try {
      fireEvent.pointerDown(chip);
      fireEvent.pointerUp(chip);
      fireEvent.click(chip);
      // Let the abandoned long-press timer elapse: it must stay silent.
      act(() => {
        vi.runAllTimers();
      });
    } finally {
      vi.useRealTimers();
    }

    expect(onToggle).toHaveBeenCalledWith('witch');
    expect(onInfoPress).not.toHaveBeenCalled();
  });

  it('shows the swap icon on a chip that has variants', () => {
    const { container } = render(
      <RoleChip
        id="witch"
        label="女巫"
        selected={false}
        onToggle={vi.fn()}
        faction="god"
        hasVariants
      />,
    );

    expect(screen.queryByText('变')).not.toBeInTheDocument();
    expect(container.querySelector('.config-role-chip-variant-mark svg')).not.toBeNull();
  });

  it('shows no variant mark on a chip without variants', () => {
    const { container } = render(
      <RoleChip id="seer" label="预言家" selected onToggle={vi.fn()} faction="god" />,
    );

    expect(container.querySelector('.config-role-chip-variant-mark')).toBeNull();
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
