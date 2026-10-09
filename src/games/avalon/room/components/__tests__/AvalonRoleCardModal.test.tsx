/** AvalonRoleCardModal: shared reveal gate with the server-side viewed anchor. */
import { fireEvent, render } from '@testing-library/react-native';

import { AvalonRoleCardModal } from '../AvalonRoleCardModal';

jest.mock('@/features/room/components/RoleRevealEffects/RoleRevealAnimator', () => {
  const { Pressable, Text } = require('react-native') as typeof import('react-native');
  return {
    RoleRevealAnimator: ({ onComplete }: { readonly onComplete: () => void }) => (
      <Pressable testID="role-reveal-animator" onPress={onComplete}>
        <Text>揭示动画</Text>
      </Pressable>
    ),
  };
});

const baseProps = {
  visible: true,
  roleId: 'merlin' as const,
  allRoles: [],
  onClose: jest.fn(),
};

describe('AvalonRoleCardModal', () => {
  it('plays the equipped animation on the first view, then shows the static card', () => {
    const view = render(
      <AvalonRoleCardModal {...baseProps} effectType="tarot" shouldPlay={true} />,
    );

    expect(view.getByTestId('role-reveal-animator')).toBeTruthy();
    fireEvent.press(view.getByTestId('role-reveal-animator'));
    expect(view.queryByTestId('role-reveal-animator')).toBeNull();
    expect(view.getByText('知道了')).toBeTruthy();
  });

  it('shows the static card directly once the seat has viewed (server anchor)', () => {
    const view = render(
      <AvalonRoleCardModal {...baseProps} effectType="tarot" shouldPlay={false} />,
    );

    expect(view.queryByTestId('role-reveal-animator')).toBeNull();
    expect(view.getByText('知道了')).toBeTruthy();
  });

  it('shows the static card directly when no effect applies (preview or takeover)', () => {
    const view = render(<AvalonRoleCardModal {...baseProps} effectType={null} shouldPlay={true} />);

    expect(view.queryByTestId('role-reveal-animator')).toBeNull();
    expect(view.getByText('知道了')).toBeTruthy();
  });
});
