/** RoleChip and Section: body opens the role info, badge toggles, variant chips wear the 变 mark. */
import { fireEvent, render, screen } from '@testing-library/react';

import { RoleChip } from '@/games/werewolf/screens/ConfigScreen/components/RoleChip';
import { Section } from '@/games/werewolf/screens/ConfigScreen/components/Section';
import { TESTIDS } from '@/testids';

describe('RoleChip', () => {
  it('renders its label and selected state', () => {
    render(<RoleChip id="seer" label="预言家" selected onToggle={vi.fn()} faction="god" />);

    expect(screen.getByTestId(TESTIDS.configRoleChip('seer'))).toHaveTextContent('预言家');
    expect(screen.getByTestId(TESTIDS.configRoleChipToggle('seer'))).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('calls onToggle with its id when the badge is pressed', () => {
    const onToggle = vi.fn<(id: string) => void>();
    render(<RoleChip id="witch" label="女巫" selected={false} onToggle={onToggle} faction="god" />);

    fireEvent.click(screen.getByTestId(TESTIDS.configRoleChipToggle('witch')));

    expect(onToggle).toHaveBeenCalledWith('witch');
  });

  it('opens the role info when the chip body is pressed without toggling', () => {
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

    expect(onInfoPress).toHaveBeenCalledWith('witch');
    expect(onToggle).not.toHaveBeenCalled();
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
