/** UndercoverWordModal contract: neutral card, identity visibility rules, equipped-animation gate. */
import type { UndercoverWordCard } from '@game-judge/game-engine/games/undercover/public';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';

import type { RoleRevealAnimatorProps } from '@/features/room/components/RoleRevealEffects/types';

import { UndercoverWordModal } from '../UndercoverWordModal';

vi.mock('@/features/room/components/RoleRevealEffects/RoleRevealAnimator', () => ({
  RoleRevealAnimator: ({ onComplete }: RoleRevealAnimatorProps) => (
    <button type="button" data-testid="role-reveal-animator" onClick={onComplete}>
      揭示动画
    </button>
  ),
}));

const wordCard: UndercoverWordCard = { kind: 'word', seat: 2, word: '苹果' };
const blankCard: UndercoverWordCard = { kind: 'blank', seat: 0 };

const baseProps = {
  effectType: null,
  isControlled: false,
  shouldConfirm: false,
  shouldPlay: false,
  allRoles: [],
  remainingCards: 4,
  isSubmitting: false,
  onClose: vi.fn(),
  onConfirm: vi.fn(),
} satisfies Omit<ComponentProps<typeof UndercoverWordModal>, 'card'>;

function renderModal(props: ComponentProps<typeof UndercoverWordModal>) {
  render(<UndercoverWordModal {...props} />);
}

describe('UndercoverWordModal', () => {
  it('shows the word with a hidden identity for word holders', async () => {
    renderModal({ ...baseProps, card: wordCard });

    expect(screen.getByTestId('undercover-word')).toHaveTextContent('苹果');
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('tells the blank card holder that they are the blank', async () => {
    renderModal({ ...baseProps, card: blankCard });

    expect(screen.getByTestId('undercover-word')).toHaveTextContent('你是白板');
    expect(screen.getByText('白板')).toBeInTheDocument();
  });

  it('plays the equipped animation first; the confirm action appears only on the static card', async () => {
    const onConfirm = vi.fn();
    renderModal({
      ...baseProps,
      card: wordCard,
      shouldConfirm: true,
      shouldPlay: true,
      onConfirm,
      effectType: 'tarot',
    });

    const animator = await screen.findByTestId('role-reveal-animator');
    expect(screen.queryByTestId('undercover-word')).toBeNull();
    expect(screen.queryByTestId('undercover-confirm')).toBeNull();
    expect(screen.queryByText('隐藏词卡')).toBeNull();

    await userEvent.click(animator);

    expect(screen.queryByTestId('role-reveal-animator')).toBeNull();
    expect(screen.getByTestId('undercover-word')).toHaveTextContent('苹果');
    await userEvent.click(screen.getByTestId('undercover-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it('shows the static card directly when no effect is equipped', async () => {
    renderModal({ ...baseProps, card: wordCard });

    expect(screen.queryByTestId('role-reveal-animator')).toBeNull();
    expect(screen.getByTestId('undercover-word')).toHaveTextContent('苹果');
  });

  it('shows the static card directly when the seat already confirmed (server anchor)', async () => {
    renderModal({ ...baseProps, card: wordCard, effectType: 'tarot', shouldPlay: false });

    expect(screen.queryByTestId('role-reveal-animator')).toBeNull();
    expect(screen.getByTestId('undercover-word')).toHaveTextContent('苹果');
  });
});
