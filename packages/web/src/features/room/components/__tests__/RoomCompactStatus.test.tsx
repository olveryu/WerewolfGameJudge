/**
 * RoomCompactStatus owns which line carries the status test id: the message when there is
 * one, otherwise the submission progress — never both, never chosen by the caller.
 */
import { render } from '@testing-library/react';

import { RoomCompactStatus } from '@/features/room/components/RoomCompactStatus';

const STATUS_ID = 'status';

describe('RoomCompactStatus status line', () => {
  it('marks the message when a message is shown', () => {
    const { getAllByTestId } = render(
      <RoomCompactStatus
        context="任务执行中"
        message="等待队员出牌…"
        progress="已出牌 1/3"
        statusTestId={STATUS_ID}
      />,
    );
    const marked = getAllByTestId(STATUS_ID);
    expect(marked).toHaveLength(1);
    expect(marked[0]).toHaveTextContent('等待队员出牌…');
  });

  it('marks the progress when there is no message', () => {
    const { getAllByTestId } = render(
      <RoomCompactStatus
        context="提案投票中"
        message={null}
        progress="已投 1/5"
        statusTestId={STATUS_ID}
      />,
    );
    const marked = getAllByTestId(STATUS_ID);
    expect(marked).toHaveLength(1);
    expect(marked[0]).toHaveTextContent('已投 1/5');
  });

  it('marks nothing when neither line is shown', () => {
    const { queryByTestId } = render(
      <RoomCompactStatus context="夜晚" message={null} progress={null} statusTestId={STATUS_ID} />,
    );
    expect(queryByTestId(STATUS_ID)).toBeNull();
  });
});
