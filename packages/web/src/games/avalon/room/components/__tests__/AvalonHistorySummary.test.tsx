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
        status="提案投票中"
        latestResult="任务一 · 成功"
        pendingSeats={[1, 3]}
        pendingLabel="未投票"
      />,
    );

    expect(getByText('提案投票中')).toBeTruthy();
    expect(getByText('任务一 · 成功')).toBeTruthy();
    const pendingRow = getByTestId('avalon-history-summary-pending-seats');
    expect(pendingRow).toBeTruthy();
    expect(getByTestId('avalon-history-summary-pending-seats-seat-1')).toBeTruthy();
    expect(getByTestId('avalon-history-summary-pending-seats-seat-3')).toBeTruthy();
    expect(getByTestId('avalon-history-summary').tagName).not.toBe('BUTTON');
  });

  it('labels the pending row 未出牌 while the quest is open', () => {
    const { getByTestId } = render(
      <AvalonHistorySummary
        status="任务执行中"
        latestResult={null}
        pendingSeats={[2]}
        pendingLabel="未出牌"
      />,
    );

    expect(getByTestId('avalon-history-summary-pending-seats-seat-2')).toBeTruthy();
  });

  it('renders no second line once every submission is in', () => {
    const { queryByTestId } = render(
      <AvalonHistorySummary
        status="提案投票中"
        latestResult={null}
        pendingSeats={[]}
        pendingLabel="未投票"
      />,
    );

    expect(queryByTestId('avalon-history-summary-pending-seats')).toBeNull();
  });
});
