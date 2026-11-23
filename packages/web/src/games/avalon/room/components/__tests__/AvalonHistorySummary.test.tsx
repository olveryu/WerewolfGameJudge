/**
 * AvalonHistorySummary: the summary bar keeps its first line and history
 * entry, and shows the pending seats on a second line while a vote or a
 * quest is open — never on the seat board, never in the details only.
 */
import { render } from '@testing-library/react';

import { AvalonHistorySummary } from '@/games/avalon/room/components/AvalonHistorySummary';

describe('AvalonHistorySummary', () => {
  it('shows the pending seats on a second line while voting is open', () => {
    const { getByTestId, getByText } = render(
      <AvalonHistorySummary
        latestResult="任务一 · 成功"
        pendingSeats={[1, 3]}
        pendingLabel="未投票"
        compact={{ context: '提案投票中', message: null, progress: '已投 3/5', isVoting: true }}
      />,
    );

    expect(getByText('提案投票中')).toBeTruthy();
    expect(getByText('任务一 · 成功')).toBeTruthy();
    const pendingRow = getByTestId('avalon-history-summary-pending-seats');
    expect(pendingRow).toBeTruthy();
    expect(pendingRow).toHaveTextContent('未投票：2号 4号');
    expect(getByTestId('avalon-history-summary').tagName).not.toBe('BUTTON');
  });

  it('labels the pending row 未出牌 while the quest is open', () => {
    const { getByTestId } = render(
      <AvalonHistorySummary
        latestResult={null}
        pendingSeats={[2]}
        pendingLabel="未出牌"
        compact={{ context: '任务执行中', message: null, progress: '已出牌 1/2', isVoting: false }}
      />,
    );

    expect(getByTestId('avalon-history-summary-pending-seats')).toHaveTextContent('未出牌：3号');
  });

  it('renders no second line once every submission is in', () => {
    const { queryByTestId } = render(
      <AvalonHistorySummary
        latestResult={null}
        pendingSeats={[]}
        pendingLabel="未投票"
        compact={{
          context: '提案投票',
          message: '已全部投票，等待揭晓',
          progress: null,
          isVoting: false,
        }}
      />,
    );

    expect(queryByTestId('avalon-history-summary-pending-seats')).toBeNull();
  });

  it('renders compact progress and the full pending list alongside the tracks and result', () => {
    const { getByText, getByTestId } = render(
      <AvalonHistorySummary
        tracks={<button type="button">任务轨道</button>}
        latestResult="任务一 · 成功"
        pendingSeats={[1, 4]}
        pendingLabel="未出牌"
        compact={{
          context: '任务二 · 任务执行中',
          message: null,
          progress: '已出牌 1/3',
          isVoting: false,
        }}
      />,
    );
    expect(getByText('任务二 · 任务执行中')).toBeTruthy();
    expect(getByText('已出牌 1/3')).toBeTruthy();
    expect(getByTestId('avalon-history-summary-pending-seats')).toHaveTextContent(
      '未出牌：2号 5号',
    );
    expect(getByText('任务轨道')).toBeTruthy();
    expect(getByText('任务一 · 成功')).toBeTruthy();
  });
});
