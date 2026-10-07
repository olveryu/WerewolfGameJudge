/** 投票结算面板：结论横幅 + 公投逐人 / 暗投汇总 + 6 秒自动关闭 + 手动关闭。 */

import type {
  AvalonLastVoteResultView,
  AvalonSeatView,
} from '@game-judge/game-engine/games/avalon/public';
import { act, fireEvent, render } from '@testing-library/react-native';

import { AvalonVoteResultPanel } from '../AvalonVoteResultPanel';

const SEATS = [
  { seat: 0, displayName: '阿明', isBot: false, isLeader: true, role: null },
  { seat: 1, displayName: '小红', isBot: false, isLeader: false, role: null },
  { seat: 2, displayName: '机器人3号', isBot: true, isLeader: false, role: null },
  { seat: 3, displayName: '阿强', isBot: false, isLeader: false, role: null },
] as AvalonSeatView[];

const REJECTED_RESULT: AvalonLastVoteResultView = {
  approved: false,
  rejectStreak: 2,
  ballots: { 0: 'approve', 1: 'reject', 2: 'reject' },
  approveCount: 1,
  rejectCount: 2,
  abstainCount: 1,
};

function renderPanel(
  result: AvalonLastVoteResultView = REJECTED_RESULT,
  seats: readonly AvalonSeatView[] = SEATS,
) {
  const onClose = jest.fn();
  const utils = render(<AvalonVoteResultPanel result={result} seats={seats} onClose={onClose} />);
  return { ...utils, onClose };
}

describe('AvalonVoteResultPanel', () => {
  it('shows the rejection banner with the streak count', () => {
    const { getByTestId } = renderPanel();
    expect(getByTestId('avalon-vote-result-banner')).toHaveTextContent('组队被否决·第 2 次');
  });

  it('shows the approval banner when the team passed', () => {
    const { getByTestId } = renderPanel({ ...REJECTED_RESULT, approved: true, rejectStreak: 0 });
    expect(getByTestId('avalon-vote-result-banner')).toHaveTextContent('组队通过');
  });

  it('lists every seat with its ballot in public mode, abstainers included', () => {
    const { getByText, getByTestId } = renderPanel();
    expect(getByText('1 号 · 阿明 · 赞成')).toBeTruthy();
    expect(getByText('2 号 · 小红 · 反对')).toBeTruthy();
    expect(getByText('3 号 · 机器人3号 · 反对')).toBeTruthy();
    expect(getByText('4 号 · 阿强 · 弃权')).toBeTruthy();
    expect(getByTestId('avalon-vote-result-row-0')).toBeTruthy();
  });

  it('shows only counts in secret mode (D7)', () => {
    const { getByTestId, queryByText } = renderPanel({ ...REJECTED_RESULT, ballots: null });
    expect(getByTestId('avalon-vote-result-counts')).toHaveTextContent('赞成 1 · 反对 2 · 弃权 1');
    expect(queryByText('1 号 · 阿明 · 赞成')).toBeNull();
  });

  it('closes on the manual button', () => {
    const { getByTestId, onClose } = renderPanel();
    fireEvent.press(getByTestId('avalon-vote-result-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('auto-closes after 6 seconds', () => {
    jest.useFakeTimers();
    try {
      const { onClose } = renderPanel();
      expect(onClose).not.toHaveBeenCalled();
      act(() => {
        jest.advanceTimersByTime(6000);
      });
      expect(onClose).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
