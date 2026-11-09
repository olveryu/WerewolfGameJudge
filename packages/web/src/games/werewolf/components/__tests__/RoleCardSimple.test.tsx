/** The werewolf role card dialog: presented identity, faction badge, variant pills. */
import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';
import { fireEvent, render, screen } from '@testing-library/react';

import { RoleCardSimple } from '@/games/werewolf/components/RoleCardSimple';
import { TESTIDS } from '@/testids';

const defaultProps: {
  readonly visible: boolean;
  readonly roleId: RoleId | null;
  readonly onClose: () => void;
} = {
  visible: true,
  roleId: 'wolf',
  onClose: vi.fn<() => void>(),
};

describe('RoleCardSimple', () => {
  it('renders nothing when not visible', () => {
    render(<RoleCardSimple {...defaultProps} visible={false} />);
    expect(screen.queryByText('狼人')).not.toBeInTheDocument();
  });

  it('renders nothing when roleId is null', () => {
    render(<RoleCardSimple {...defaultProps} roleId={null} />);
    expect(screen.queryByText('狼人')).not.toBeInTheDocument();
  });

  it('shows the role name, faction badge, portrait and structured description', () => {
    render(<RoleCardSimple {...defaultProps} />);
    expect(screen.getByText('狼人')).toBeInTheDocument();
    expect(screen.getByText('狼人阵营')).toBeInTheDocument();
    expect(screen.getByTestId('role-badge')).toHaveAttribute('src', expect.stringMatching(/wolf/));
    expect(screen.getByText('主动技能')).toBeInTheDocument();
  });

  it('calls onClose when the confirm button is pressed', () => {
    const onClose = vi.fn<() => void>();
    render(<RoleCardSimple {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', { name: '知道了' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['seer', '神职阵营', '预言家'],
    ['villager', '好人阵营', '平民'],
    ['witch', '神职阵营', '女巫'],
    ['hunter', '神职阵营', '猎人'],
  ] satisfies [RoleId, string, string][])('shows %s with its faction', (roleId, faction, name) => {
    render(<RoleCardSimple {...defaultProps} roleId={roleId} />);
    expect(screen.getByText(faction)).toBeInTheDocument();
    expect(screen.getByText(name)).toBeInTheDocument();
  });

  it('prefixes the seer label on dual-seer boards, including a disguised mirrorSeer', () => {
    const { rerender } = render(<RoleCardSimple {...defaultProps} roleId="seer" seerLabel={1} />);
    expect(screen.getByText('1号预言家')).toBeInTheDocument();

    rerender(<RoleCardSimple {...defaultProps} roleId="mirrorSeer" seerLabel={2} />);
    expect(screen.getByText('2号预言家')).toBeInTheDocument();
  });

  it('switches variants from the pill bar and shows the active variant', () => {
    const onVariantSelect = vi.fn<(variantId: RoleId) => void>();
    render(
      <RoleCardSimple
        {...defaultProps}
        roleId="witch"
        showRealIdentity
        variantIds={['witch', 'poisoner']}
        activeVariant="poisoner"
        onVariantSelect={onVariantSelect}
      />,
    );

    expect(screen.getByTestId(TESTIDS.configVariantOption('poisoner'))).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    fireEvent.click(screen.getByTestId(TESTIDS.configVariantOption('witch')));

    expect(onVariantSelect).toHaveBeenCalledWith('witch');
  });
});
