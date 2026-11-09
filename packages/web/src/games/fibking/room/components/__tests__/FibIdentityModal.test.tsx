/** FibIdentityModal contract: per-role word/definition visibility, public result, equipped-animation gate. */
import type { FibRoundView } from '@game-judge/game-engine/games/fibking/public';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';

import type { RoleRevealAnimatorProps } from '@/features/room/components/RoleRevealEffects/types';
import { TESTIDS } from '@/testids';

import { FibIdentityModal } from '../FibIdentityModal';

vi.mock('@/features/room/components/RoleRevealEffects/RoleRevealAnimator', () => ({
  RoleRevealAnimator: ({ onComplete }: RoleRevealAnimatorProps) => (
    <button type="button" data-testid="role-reveal-animator" onClick={onComplete}>
      揭示动画
    </button>
  ),
}));

function createOngoingView(
  viewerRole: Exclude<Extract<FibRoundView, { phase: 'ongoing' }>['viewerRole'], null>,
  word = '山谷',
): Extract<FibRoundView, { phase: 'ongoing' }> {
  return {
    phase: 'ongoing',
    roundId: 'round-1',
    viewerSeat: viewerRole === 'guesser' ? 0 : viewerRole === 'honest' ? 1 : 2,
    viewerRole,
    word,
    definition:
      viewerRole === 'honest'
        ? {
            coreMeaning: '两山之间低洼而且狭长的自然地形区域。',
            usageNote: '常用于描述山地之间可供河流或道路穿行的低地。',
          }
        : null,
    guesserSeat: 0,
    honestSeat: null,
    guesses: [],
  };
}

function createViewingView(viewerHasViewed: boolean): Extract<FibRoundView, { phase: 'viewing' }> {
  return {
    phase: 'viewing',
    roundId: 'round-1',
    viewerSeat: 2,
    viewerRole: 'fibber',
    word: '山谷',
    definition: null,
    guesserSeat: 0,
    honestSeat: null,
    viewerHasViewed,
    unviewedSeats: viewerHasViewed ? [0, 1] : [0, 1, 2],
  };
}

const baseProps = {
  effectType: null,
  shouldPlay: false,
  allRoles: [],
  remainingCards: 4,
  onClose: vi.fn(),
} satisfies Omit<ComponentProps<typeof FibIdentityModal>, 'view'>;

describe('FibIdentityModal', () => {
  it.each([
    ['guesser', '大聪明'],
    ['fibber', '瞎掰王'],
  ] as const)('shows the word but hides the definition for %s', (role, roleName) => {
    render(<FibIdentityModal view={createOngoingView(role)} {...baseProps} />);

    expect(screen.getByTestId(TESTIDS.fibIdentityModal)).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.fibIdentityRole)).toHaveTextContent(roleName);
    expect(screen.getByTestId(TESTIDS.fibIdentityWord)).toHaveTextContent('山谷');
    expect(screen.getByTestId(TESTIDS.fibIdentityPinyin)).toHaveTextContent('shān gǔ');
    expect(screen.queryByTestId(TESTIDS.fibIdentityDefinition)).toBeNull();
    expect(screen.queryByTestId(TESTIDS.fibIdentityCoreMeaning)).toBeNull();
    expect(screen.queryByTestId(TESTIDS.fibIdentityUsageNote)).toBeNull();
  });

  it('shows the word and definition to the honest player', () => {
    render(<FibIdentityModal view={createOngoingView('honest')} {...baseProps} />);

    expect(screen.getByTestId(TESTIDS.fibIdentityRole)).toHaveTextContent('老实人');
    expect(screen.getByTestId(TESTIDS.fibIdentityWord)).toHaveTextContent('山谷');
    expect(screen.getByTestId(TESTIDS.fibIdentityPinyin)).toHaveTextContent('shān gǔ');
    expect(screen.getByText('核心释义')).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.fibIdentityCoreMeaning)).toHaveTextContent(
      '两山之间低洼而且狭长的自然地形区域。',
    );
    expect(screen.getByText('使用提示')).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.fibIdentityUsageNote)).toHaveTextContent(
      '常用于描述山地之间可供河流或道路穿行的低地。',
    );
  });

  it('shows the word and definition without a player role to a spectator', () => {
    const spectatorView: Extract<FibRoundView, { phase: 'ongoing' }> = {
      phase: 'ongoing',
      roundId: 'round-1',
      viewerSeat: null,
      viewerRole: null,
      word: '山谷',
      definition: {
        coreMeaning: '两山之间低洼而且狭长的自然地形区域。',
        usageNote: '常用于描述山地之间可供河流或道路穿行的低地。',
      },
      guesserSeat: 0,
      honestSeat: null,
      guesses: [],
    };
    render(<FibIdentityModal view={spectatorView} {...baseProps} />);

    expect(screen.getByText('本轮题目')).toBeInTheDocument();
    expect(screen.getByTestId(TESTIDS.fibIdentityRole)).toHaveTextContent('观战视角');
    expect(screen.getByTestId(TESTIDS.fibIdentityWord)).toHaveTextContent('山谷');
    expect(screen.getByTestId(TESTIDS.fibIdentityCoreMeaning)).toHaveTextContent(
      '两山之间低洼而且狭长的自然地形区域。',
    );
    expect(screen.getByTestId(TESTIDS.fibIdentityUsageNote)).toHaveTextContent(
      '常用于描述山地之间可供河流或道路穿行的低地。',
    );
  });

  it('shows pinyin for a multi-character Chinese term', () => {
    render(<FibIdentityModal view={createOngoingView('fibber', '电子榨菜')} {...baseProps} />);

    expect(screen.getByTestId(TESTIDS.fibIdentityPinyin)).toHaveTextContent('diàn zǐ zhà cài');
  });

  it('reveals every assignment after the round ends and closes through the shared action', async () => {
    const onClose = vi.fn();
    const view: Extract<FibRoundView, { phase: 'ended' }> = {
      phase: 'ended',
      roundId: 'round-1',
      viewerSeat: null,
      viewerRole: null,
      word: '山谷',
      definition: {
        coreMeaning: '两山之间低洼而且狭长的自然地形区域。',
        usageNote: '常用于描述山地之间可供河流或道路穿行的低地。',
      },
      guesserSeat: 0,
      honestSeat: 1,
    };
    render(<FibIdentityModal view={view} {...baseProps} onClose={onClose} />);

    expect(screen.getByTestId(TESTIDS.fibIdentityRole)).toHaveTextContent('公开结果');
    expect(screen.getByText('1号 · 大聪明')).toBeInTheDocument();
    expect(screen.getByText('2号 · 老实人')).toBeInTheDocument();
    expect(screen.getByText('其余座位 · 瞎掰王')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: '知道了' }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  describe('equipped reveal animation gate (server anchor)', () => {
    it('plays the animation first and swaps to the static card on completion', async () => {
      render(
        <FibIdentityModal
          view={createOngoingView('guesser')}
          {...baseProps}
          effectType="tarot"
          shouldPlay
        />,
      );

      const animator = await screen.findByTestId('role-reveal-animator');
      expect(screen.queryByTestId(TESTIDS.fibIdentityModal)).toBeNull();

      await userEvent.click(animator);

      expect(screen.queryByTestId('role-reveal-animator')).toBeNull();
      expect(screen.getByTestId(TESTIDS.fibIdentityModal)).toBeInTheDocument();
      expect(screen.getByTestId(TESTIDS.fibIdentityRole)).toHaveTextContent('大聪明');
    });

    it('shows the static card directly when no effect is equipped', () => {
      render(
        <FibIdentityModal
          view={createOngoingView('fibber')}
          {...baseProps}
          effectType={null}
          shouldPlay
        />,
      );

      expect(screen.queryByTestId('role-reveal-animator')).toBeNull();
      expect(screen.getByTestId(TESTIDS.fibIdentityModal)).toBeInTheDocument();
    });

    it('never replays once the server record says viewed, even when equipped', () => {
      render(
        <FibIdentityModal
          view={createViewingView(true)}
          {...baseProps}
          effectType="tarot"
          shouldPlay={false}
        />,
      );

      expect(screen.queryByTestId('role-reveal-animator')).toBeNull();
      expect(screen.getByTestId(TESTIDS.fibIdentityModal)).toBeInTheDocument();
    });
  });
});
