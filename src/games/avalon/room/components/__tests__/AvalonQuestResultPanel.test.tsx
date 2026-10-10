/** 任务结算面板：结论横幅 + 成功/失败牌数 + 6 秒自动关闭 + 手动关闭。 */

import type { AvalonQuestHistoryView } from '@game-judge/game-engine/games/avalon/public';
import { act, fireEvent, render } from '@testing-library/react-native';

import { AvalonQuestResultPanel } from '../AvalonQuestResultPanel';

const ENTRY: AvalonQuestHistoryView = {
  round: 2,
  leaderSeat: 0,
  teamSeats: [0, 1, 2],
  ballots: null,
  approveCount: 5,
  rejectCount: 0,
  abstainCount: 0,
  result: 'fail',
  successCount: 2,
  failCount: 1,
};

function renderPanel(entry: AvalonQuestHistoryView = ENTRY) {
  const onClose = jest.fn();
  const utils = render(<AvalonQuestResultPanel entry={entry} onClose={onClose} />);
  return { ...utils, onClose };
}

describe('AvalonQuestResultPanel', () => {
  it('shows the failure banner with the round and the card counts', () => {
    const { getByTestId } = renderPanel();
    expect(getByTestId('avalon-quest-result-banner')).toHaveTextContent('第 2 轮 · 任务失败');
    expect(getByTestId('avalon-quest-result-counts')).toHaveTextContent('成功牌 2 · 失败牌 1');
  });

  it('shows the success banner when the quest succeeded', () => {
    const { getByTestId } = renderPanel({
      ...ENTRY,
      result: 'success',
      failCount: 0,
      successCount: 3,
    });
    expect(getByTestId('avalon-quest-result-banner')).toHaveTextContent('第 2 轮 · 任务成功');
  });

  it('closes from the button and automatically after 6 seconds', () => {
    jest.useFakeTimers();
    try {
      const first = renderPanel();
      fireEvent.press(first.getByTestId('avalon-quest-result-close'));
      expect(first.onClose).toHaveBeenCalledTimes(1);
      const second = renderPanel();
      act(() => {
        jest.advanceTimersByTime(6000);
      });
      expect(second.onClose).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
