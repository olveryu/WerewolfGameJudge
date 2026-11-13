import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RoomSeatBoard } from '@/features/room/components/RoomSeatBoard';
import type { RoomSeatViewModel } from '@/features/room/model/RoomSeatDataSource';
import type { RoomSeatBoardModel } from '@/features/room/model/RoomShellModel';
import { TESTIDS } from '@/testids';

function renderPagedBoard() {
  const seats = Array.from({ length: 73 }, (_, seat): RoomSeatViewModel => ({
    seat,
    player: null,
    isSelf: false,
    highlight: 'none',
    secondaryLabel: null,
    showReadyBadge: false,
    statusBadge: null,
    indicators: null,
    isStatusEmphasized: false,
    showLevel: false,
    decorationsEnabled: false,
  }));
  const model: RoomSeatBoardModel = {
    source: { count: seats.length, revision: 1, getSeat: (index) => seats[index]! },
    visuallyDisabled: false,
    onSeatPress: () => {},
    onBotSeatLongPress: null,
  };
  render(<RoomSeatBoard model={model} header={null} footer={null} />);
}

describe('RoomSeatBoard pagination', () => {
  it('associates invalid page feedback and navigates to a valid page', async () => {
    const user = userEvent.setup();
    renderPagedBoard();

    const input = screen.getByRole('textbox', { name: '座位页码' });
    expect(input).not.toHaveAttribute('aria-invalid', 'true');

    await user.clear(input);
    await user.type(input, '0');

    expect(input).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText('请输入 1 至 2 之间的页码')).not.toBeInTheDocument();

    await user.tab();

    const error = screen.getByText('请输入 1 至 2 之间的页码');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(input).toHaveAttribute('aria-describedby', error.id);

    await user.click(input);
    await user.clear(input);
    await user.type(input, '2');
    expect(input).not.toHaveAttribute('aria-invalid', 'true');
    await user.keyboard('{Enter}');

    expect(screen.getByTestId(TESTIDS.seatTilePressable(72))).toBeInTheDocument();
  });
});
