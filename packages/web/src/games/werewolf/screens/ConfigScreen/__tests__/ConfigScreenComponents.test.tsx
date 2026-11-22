/** RoleChip and Section: tap toggles the tile, long-press opens the role info, no marks. */
import { act, fireEvent, render, screen } from '@testing-library/react';

import { RoleChip } from '@/games/werewolf/screens/ConfigScreen/components/RoleChip';
import { Section } from '@/games/werewolf/screens/ConfigScreen/components/Section';
import { TESTIDS } from '@/testids';

afterEach(() => {
  vi.useRealTimers();
});

describe('RoleChip', () => {
  it('renders its label and selected state on the tile itself', () => {
    render(<RoleChip id="seer" label="预言家" selected onToggle={vi.fn()} faction="god" />);

    const chip = screen.getByTestId(TESTIDS.configRoleChip('seer'));
    expect(chip).toHaveTextContent('预言家');
    expect(chip).toHaveAttribute('aria-pressed', 'true');
  });

  it('toggles on a tap without opening the role info', () => {
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
    fireEvent.pointerDown(chip);
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(onInfoPress).toHaveBeenCalledWith('witch');
    expect(onToggle).not.toHaveBeenCalled();

    // The click that follows the long-press release must not toggle the tile.
    fireEvent.click(chip);
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
    fireEvent.pointerDown(chip);
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.pointerUp(chip);
    fireEvent.click(chip);

    expect(onToggle).toHaveBeenCalledWith('witch');
    expect(onInfoPress).not.toHaveBeenCalled();
  });

  it('renders no checkmark or plus badge on the tile', () => {
    render(
      <RoleChip
        id="seer"
        label="预言家"
        selected
        onToggle={vi.fn()}
        faction="god"
        onInfoPress={vi.fn()}
      />,
    );

    expect(screen.queryByText('✓')).not.toBeInTheDocument();
    expect(screen.queryByText('＋')).not.toBeInTheDocument();
  });

  it('shows the swap mark on a tile that has variants', () => {
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

    const mark = container.querySelector('.config-role-chip-variant-mark');
    expect(mark).not.toBeNull();
    expect(mark).toHaveTextContent('⇄');
  });

  it('shows no variant mark on a tile without variants', () => {
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
