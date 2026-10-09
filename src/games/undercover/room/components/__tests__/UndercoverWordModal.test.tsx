/** UndercoverWordModal contract: neutral card, identity visibility rules, equipped-animation gate. */
import type { UndercoverWordCard } from '@game-judge/game-engine/games/undercover/public';
import { fireEvent, render } from '@testing-library/react-native';

import { UndercoverWordModal } from '../UndercoverWordModal';

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

const wordCard: UndercoverWordCard = { kind: 'word', seat: 2, word: '苹果' };
const blankCard: UndercoverWordCard = { kind: 'blank', seat: 0 };

const baseProps = {
  isControlled: false,
  shouldConfirm: false,
  shouldPlay: false,
  allRoles: [],
  isSubmitting: false,
  onClose: jest.fn(),
  onConfirm: jest.fn(),
};

describe('UndercoverWordModal', () => {
  it('shows the word with a hidden identity for word holders', () => {
    const view = render(<UndercoverWordModal {...baseProps} card={wordCard} />);

    expect(view.getByTestId('undercover-word')).toHaveTextContent('苹果');
    expect(view.getByText('?')).toBeTruthy();
  });

  it('tells the blank card holder that they are the blank', () => {
    const view = render(<UndercoverWordModal {...baseProps} card={blankCard} />);

    expect(view.getByTestId('undercover-word')).toHaveTextContent('你是白板');
    expect(view.getByText('白板')).toBeTruthy();
  });

  it('plays the equipped animation first; the confirm action appears only on the static card', () => {
    const onConfirm = jest.fn();
    const view = render(
      <UndercoverWordModal
        {...baseProps}
        card={wordCard}
        shouldConfirm
        shouldPlay
        onConfirm={onConfirm}
        effectType="tarot"
      />,
    );

    expect(view.getByTestId('role-reveal-animator')).toBeTruthy();
    expect(view.queryByTestId('undercover-word')).toBeNull();
    expect(view.queryByTestId('undercover-confirm')).toBeNull();
    expect(view.queryByText('隐藏词卡')).toBeNull();

    fireEvent.press(view.getByTestId('role-reveal-animator'));

    expect(view.queryByTestId('role-reveal-animator')).toBeNull();
    expect(view.getByTestId('undercover-word')).toHaveTextContent('苹果');
    fireEvent.press(view.getByTestId('undercover-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('shows the static card directly when no effect is equipped', () => {
    const view = render(<UndercoverWordModal {...baseProps} card={wordCard} effectType={null} />);

    expect(view.queryByTestId('role-reveal-animator')).toBeNull();
    expect(view.getByTestId('undercover-word')).toHaveTextContent('苹果');
  });

  it('shows the static card directly when the seat already confirmed (server anchor)', () => {
    const view = render(
      <UndercoverWordModal {...baseProps} card={wordCard} effectType="tarot" shouldPlay={false} />,
    );

    expect(view.queryByTestId('role-reveal-animator')).toBeNull();
    expect(view.getByTestId('undercover-word')).toHaveTextContent('苹果');
  });
});
