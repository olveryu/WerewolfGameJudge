import type { FibRoundView } from '@game-judge/game-engine/games/fibking/public';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactElement } from 'react';

import { TESTIDS } from '@/testids';

import { FibIdentityModal } from '../FibIdentityModal';

jest.mock('@/features/room/components/RevealAnimationGate', () => {
  const ReactLib = require('react') as typeof import('react');
  const { Pressable, Text } = require('react-native') as typeof import('react-native');
  return {
    RevealAnimationGate: ({
      shouldPlay,
      children,
    }: {
      readonly shouldPlay: boolean;
      readonly children: React.ReactNode;
    }) => {
      const [done, setDone] = ReactLib.useState(false);
      if (!shouldPlay || done) return <>{children}</>;
      return (
        <Pressable testID="role-reveal-animator" onPress={() => setDone(true)}>
          <Text>揭示动画</Text>
        </Pressable>
      );
    },
  };
});

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

function renderModal(element: ReactElement): ReturnType<typeof render> {
  return render(element);
}

const baseProps = {
  shouldPlay: false,
  allRoles: [],
  confirmText: '知道了',
  onConfirm: jest.fn(),
} as const;

describe('FibIdentityModal', () => {
  it.each([
    ['guesser', '大聪明'],
    ['fibber', '瞎掰王'],
  ] as const)('shows the word but hides the definition for %s', (role, roleName) => {
    const view = renderModal(<FibIdentityModal view={createOngoingView(role)} {...baseProps} />);

    expect(view.getByTestId(TESTIDS.fibIdentityModal)).toBeTruthy();
    expect(view.getByTestId(TESTIDS.fibIdentityRole)).toHaveTextContent(roleName);
    expect(view.getByTestId(TESTIDS.fibIdentityWord)).toHaveTextContent('山谷');
    expect(view.getByTestId(TESTIDS.fibIdentityPinyin)).toHaveTextContent('shān gǔ');
    expect(view.queryByTestId(TESTIDS.fibIdentityDefinition)).toBeNull();
    expect(view.queryByTestId(TESTIDS.fibIdentityCoreMeaning)).toBeNull();
    expect(view.queryByTestId(TESTIDS.fibIdentityUsageNote)).toBeNull();
  });

  it('shows the word and definition to the honest player', () => {
    const view = renderModal(
      <FibIdentityModal view={createOngoingView('honest')} {...baseProps} />,
    );

    expect(view.getByTestId(TESTIDS.fibIdentityRole)).toHaveTextContent('老实人');
    expect(view.getByTestId(TESTIDS.fibIdentityWord)).toHaveTextContent('山谷');
    expect(view.getByTestId(TESTIDS.fibIdentityPinyin)).toHaveTextContent('shān gǔ');
    expect(view.getByText('核心释义')).toBeTruthy();
    expect(view.getByTestId(TESTIDS.fibIdentityCoreMeaning)).toHaveTextContent(
      '两山之间低洼而且狭长的自然地形区域。',
    );
    expect(view.getByText('使用提示')).toBeTruthy();
    expect(view.getByTestId(TESTIDS.fibIdentityUsageNote)).toHaveTextContent(
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
    };
    const view = renderModal(<FibIdentityModal view={spectatorView} {...baseProps} />);

    expect(view.getByText('本轮题目')).toBeTruthy();
    expect(view.getByTestId(TESTIDS.fibIdentityRole)).toHaveTextContent('观战视角');
    expect(view.getByTestId(TESTIDS.fibIdentityWord)).toHaveTextContent('山谷');
    expect(view.getByTestId(TESTIDS.fibIdentityCoreMeaning)).toHaveTextContent(
      '两山之间低洼而且狭长的自然地形区域。',
    );
    expect(view.getByTestId(TESTIDS.fibIdentityUsageNote)).toHaveTextContent(
      '常用于描述山地之间可供河流或道路穿行的低地。',
    );
  });

  it('shows pinyin for a multi-character Chinese term', () => {
    const chinese = renderModal(
      <FibIdentityModal view={createOngoingView('fibber', '电子榨菜')} {...baseProps} />,
    );
    expect(chinese.getByTestId(TESTIDS.fibIdentityPinyin)).toHaveTextContent('diàn zǐ zhà cài');
  });

  it('reveals every assignment after the round ends and closes through the shared action', () => {
    const onConfirm = jest.fn();
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
    const screen = renderModal(
      <FibIdentityModal view={view} {...baseProps} onConfirm={onConfirm} />,
    );

    expect(screen.getByText('公开结果')).toBeTruthy();
    expect(screen.getByText('1号 · 大聪明')).toBeTruthy();
    expect(screen.getByText('2号 · 老实人')).toBeTruthy();
    expect(screen.getByText('其余座位 · 瞎掰王')).toBeTruthy();
    fireEvent.press(screen.getByText('知道了'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  describe('equipped reveal animation gate (server anchor)', () => {
    it('plays the animation first and swaps to the static card on completion', () => {
      const view = renderModal(
        <FibIdentityModal
          view={createOngoingView('guesser')}
          {...baseProps}
          effectType="tarot"
          shouldPlay={true}
        />,
      );

      expect(view.getByTestId('role-reveal-animator')).toBeTruthy();
      expect(view.queryByTestId(TESTIDS.fibIdentityModal)).toBeNull();

      fireEvent.press(view.getByTestId('role-reveal-animator'));

      expect(view.queryByTestId('role-reveal-animator')).toBeNull();
      expect(view.getByTestId(TESTIDS.fibIdentityModal)).toBeTruthy();
      expect(view.getByTestId(TESTIDS.fibIdentityRole)).toHaveTextContent('大聪明');
    });

    it('shows the static card directly when no effect is equipped', () => {
      const view = renderModal(
        <FibIdentityModal
          view={createOngoingView('fibber')}
          {...baseProps}
          effectType={null}
          shouldPlay={true}
        />,
      );

      expect(view.queryByTestId('role-reveal-animator')).toBeNull();
      expect(view.getByTestId(TESTIDS.fibIdentityModal)).toBeTruthy();
    });

    it('never replays once the server record says viewed, even when equipped', () => {
      const view = renderModal(
        <FibIdentityModal
          view={createViewingView(true)}
          {...baseProps}
          effectType="tarot"
          shouldPlay={false}
        />,
      );

      expect(view.queryByTestId('role-reveal-animator')).toBeNull();
      expect(view.getByTestId(TESTIDS.fibIdentityModal)).toBeTruthy();
    });
  });

  describe('viewing confirmation', () => {
    it('offers the viewing confirm label and submits through onConfirm', () => {
      const onConfirm = jest.fn();
      const view = renderModal(
        <FibIdentityModal
          view={createViewingView(false)}
          {...baseProps}
          confirmText="我已看清"
          onConfirm={onConfirm}
        />,
      );

      fireEvent.press(view.getByText('我已看清'));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });
  });
});
