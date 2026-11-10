/**
 * AvalonHistorySummary: the summary bar keeps its first line and history
 * entry, and shows the pending seats on a second line while a vote or a
 * quest is open — never on the seat board, never in the details only.
 */
import { fireEvent, render } from '@testing-library/react';

import { AvalonHistorySummary } from '@/games/avalon/room/components/AvalonHistorySummary';

describe('AvalonHistorySummary', () => {
  it('shows the pending seats on a second line while voting is open', () => {
    const onOpenHistory = vi.fn();
    const { getByTestId, getByText } = render(
      <AvalonHistorySummary
        summary="第2任务 · 第1次提案投票中"
        pendingSeats={[1, 3]}
        pendingLabel="未投票"
        onOpenHistory={onOpenHistory}
      />,
    );

    expect(getByText('第2任务 · 第1次提案投票中')).toBeTruthy();
    expect(getByText('对局记录 ›')).toBeTruthy();
    const pendingRow = getByTestId('avalon-history-summary-pending-seats');
    expect(pendingRow).toBeTruthy();
    expect(getByTestId('avalon-history-summary-pending-seats-seat-1')).toBeTruthy();
    expect(getByTestId('avalon-history-summary-pending-seats-seat-3')).toBeTruthy();
    fireEvent.click(getByTestId('avalon-history-summary'));
    expect(onOpenHistory).toHaveBeenCalledTimes(1);
  });

  it('labels the pending row 未出牌 while the quest is open', () => {
    const { getByTestId } = render(
      <AvalonHistorySummary
        summary="第2任务 · 任务执行中"
        pendingSeats={[2]}
        pendingLabel="未出牌"
        onOpenHistory={() => undefined}
      />,
    );

    expect(getByTestId('avalon-history-summary-pending-seats-seat-2')).toBeTruthy();
  });

  it('renders no second line once every submission is in', () => {
    const { queryByTestId } = render(
      <AvalonHistorySummary
        summary="第2任务 · 第1次提案投票中"
        pendingSeats={[]}
        pendingLabel="未投票"
        onOpenHistory={() => undefined}
      />,
    );

    expect(queryByTestId('avalon-history-summary-pending-seats')).toBeNull();
  });
});
