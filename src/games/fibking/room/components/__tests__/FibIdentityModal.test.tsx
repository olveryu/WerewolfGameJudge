import type { FibRoundView } from '@game-judge/game-engine/games/fibking/public';
import { fireEvent, render } from '@testing-library/react-native';

import { TESTIDS } from '@/testids';

import { FibIdentityModal } from '../FibIdentityModal';

function createOngoingView(
  viewerRole: Extract<FibRoundView, { phase: 'ongoing' }>['viewerRole'],
  word = '山谷',
): Extract<FibRoundView, { phase: 'ongoing' }> {
  return {
    phase: 'ongoing',
    roundId: 'round-1',
    viewerSeat: viewerRole === 'guesser' ? 0 : viewerRole === 'honest' ? 1 : 2,
    viewerRole,
    word,
    definition: viewerRole === 'honest' ? '两山之间低洼狭长的地带' : null,
    guesserSeat: 0,
    honestSeat: null,
  };
}

describe('FibIdentityModal', () => {
  it.each([
    ['guesser', '大聪明'],
    ['fibber', '瞎掰王'],
  ] as const)('shows the word but hides the definition for %s', (role, roleName) => {
    const view = render(<FibIdentityModal view={createOngoingView(role)} onClose={jest.fn()} />);

    expect(view.getByTestId(TESTIDS.fibIdentityModal)).toBeTruthy();
    expect(view.getByTestId(TESTIDS.fibIdentityRole)).toHaveTextContent(roleName);
    expect(view.getByTestId(TESTIDS.fibIdentityWord)).toHaveTextContent('山谷');
    expect(view.getByTestId(TESTIDS.fibIdentityPinyin)).toHaveTextContent('shān gǔ');
    expect(view.queryByTestId(TESTIDS.fibIdentityDefinition)).toBeNull();
  });

  it('shows the word and definition to the honest player', () => {
    const view = render(
      <FibIdentityModal view={createOngoingView('honest')} onClose={jest.fn()} />,
    );

    expect(view.getByTestId(TESTIDS.fibIdentityRole)).toHaveTextContent('老实人');
    expect(view.getByTestId(TESTIDS.fibIdentityWord)).toHaveTextContent('山谷');
    expect(view.getByTestId(TESTIDS.fibIdentityPinyin)).toHaveTextContent('shān gǔ');
    expect(view.getByTestId(TESTIDS.fibIdentityDefinition)).toHaveTextContent(
      '两山之间低洼狭长的地带',
    );
  });

  it('shows pinyin for multi-character network terms without duplicating Latin-only words', () => {
    const chinese = render(
      <FibIdentityModal view={createOngoingView('fibber', '电子榨菜')} onClose={jest.fn()} />,
    );
    expect(chinese.getByTestId(TESTIDS.fibIdentityPinyin)).toHaveTextContent('diàn zǐ zhà cài');
    chinese.unmount();

    const latin = render(
      <FibIdentityModal view={createOngoingView('fibber', 'Citywalk')} onClose={jest.fn()} />,
    );
    expect(latin.queryByTestId(TESTIDS.fibIdentityPinyin)).toBeNull();
  });

  it('reveals every assignment after the round ends and closes through the shared action', () => {
    const onClose = jest.fn();
    const view: Extract<FibRoundView, { phase: 'ended' }> = {
      phase: 'ended',
      roundId: 'round-1',
      viewerSeat: null,
      viewerRole: null,
      word: '山谷',
      definition: '两山之间低洼狭长的地带',
      guesserSeat: 0,
      honestSeat: 1,
    };
    const screen = render(<FibIdentityModal view={view} onClose={onClose} />);

    expect(screen.getByText('公开结果')).toBeTruthy();
    expect(screen.getByText('1号 · 大聪明')).toBeTruthy();
    expect(screen.getByText('2号 · 老实人')).toBeTruthy();
    expect(screen.getByText('其余座位 · 瞎掰王')).toBeTruthy();
    fireEvent.press(screen.getByText('知道了'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
