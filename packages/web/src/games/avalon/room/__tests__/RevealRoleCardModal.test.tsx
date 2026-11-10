/**
 * RevealRoleCardModal: the shared reveal gate assembly with the
 * server-side viewed anchor, exercised through Avalon's real adapter
 * (the assembly's first consumer pair was Avalon/Demo).
 *
 * Lives in Avalon's test tree, not the shared layer's: the shared room
 * layer must stay game-agnostic (roomGameAgnostic contract), and this
 * test binds a real game's adapter.
 */
import { fireEvent, render } from '@testing-library/react';

import { RevealRoleCardModal } from '@/features/room/components/RevealRoleCardModal';
import type { RoleRevealAnimatorProps } from '@/features/room/components/RoleRevealEffects/types';
import { toRevealRoleData } from '@/games/avalon/components/AvalonRoleCardAdapter';

vi.mock('@/features/room/components/RoleRevealEffects/RoleRevealAnimator', () => ({
  RoleRevealAnimator: ({ onComplete }: RoleRevealAnimatorProps) => (
    <button type="button" data-testid="role-reveal-animator" onClick={onComplete}>
      揭示动画
    </button>
  ),
}));

const baseProps = {
  visible: true,
  roleKey: 'merlin' as const,
  toRoleData: toRevealRoleData,
  allRoles: [],
  remainingCards: 5,
  onClose: vi.fn(),
};

describe('RevealRoleCardModal', () => {
  it('plays the equipped animation on the first view, then shows the static card', () => {
    const view = render(
      <RevealRoleCardModal {...baseProps} effectType="tarot" shouldPlay={true} />,
    );

    expect(view.getByTestId('role-reveal-animator')).toBeTruthy();
    fireEvent.click(view.getByTestId('role-reveal-animator'));
    expect(view.queryByTestId('role-reveal-animator')).toBeNull();
    expect(view.getByText('知道了')).toBeTruthy();
  });

  it('shows the static card directly once the seat has viewed (server anchor)', () => {
    const view = render(
      <RevealRoleCardModal {...baseProps} effectType="tarot" shouldPlay={false} />,
    );

    expect(view.queryByTestId('role-reveal-animator')).toBeNull();
    expect(view.getByText('知道了')).toBeTruthy();
  });

  it('shows the static card directly when no effect applies (preview or takeover)', () => {
    const view = render(<RevealRoleCardModal {...baseProps} effectType={null} shouldPlay={true} />);

    expect(view.queryByTestId('role-reveal-animator')).toBeNull();
    expect(view.getByText('知道了')).toBeTruthy();
  });

  it('renders nothing when the role key is null (no card, no gate)', () => {
    const view = render(
      <RevealRoleCardModal {...baseProps} roleKey={null} effectType="tarot" shouldPlay={true} />,
    );

    expect(view.queryByTestId('role-reveal-animator')).toBeNull();
    expect(view.queryByText('知道了')).toBeNull();
  });
});
