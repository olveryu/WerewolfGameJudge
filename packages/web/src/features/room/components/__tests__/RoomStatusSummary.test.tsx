import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RoomStatusSummary } from '../RoomStatusSummary';

it('opens details from the whole summary with pointer and keyboard while exposing stage and pending seats', async () => {
  const user = userEvent.setup();
  const onOpen = vi.fn();
  render(
    <RoomStatusSummary
      header={{ title: '本轮状态', phase: '表决中' }}
      summary="2/4 人已提交"
      pendingSeats={[1, 3]}
      pendingLabel="未提交"
      action={{ label: '详情', accessibleLabel: '查看本轮详情', onOpen }}
    />,
  );
  const button = screen.getByRole('button', { name: '查看本轮详情' });
  expect(button).toHaveAttribute('type', 'button');
  expect(button).toHaveAttribute('aria-haspopup', 'dialog');
  expect(button).toHaveAccessibleDescription('2/4 人已提交');
  expect(screen.getByText('本轮状态')).toBeInTheDocument();
  expect(screen.getByText('表决中')).toBeInTheDocument();
  expect(screen.getByText('未提交：')).toBeInTheDocument();
  expect(screen.getByLabelText('2号')).toBeInTheDocument();
  expect(screen.getByLabelText('4号')).toBeInTheDocument();
  await user.tab();
  expect(button).toHaveFocus();
  await user.keyboard('{Enter}');
  await user.keyboard(' ');
  await user.click(screen.getByText('2/4 人已提交'));
  expect(onOpen).toHaveBeenCalledTimes(3);
});

it('removes the detail action without losing the summary when details are displayed elsewhere', async () => {
  const user = userEvent.setup();
  const onOpen = vi.fn();
  const { rerender } = render(
    <RoomStatusSummary
      summary="全部提交完毕"
      action={{ label: '详情', accessibleLabel: '查看本轮详情', onOpen }}
    />,
  );
  await user.click(screen.getByRole('button', { name: '查看本轮详情' }));
  rerender(
    <RoomStatusSummary
      summary="全部提交完毕"
      detail="即将公布结果"
      pendingSeats={[]}
      action={null}
    />,
  );
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
  expect(screen.queryByText('详情')).not.toBeInTheDocument();
  expect(screen.queryByText('未投票：')).not.toBeInTheDocument();
  expect(screen.getByText('即将公布结果')).toBeInTheDocument();
  await user.click(screen.getByText('全部提交完毕'));
  expect(onOpen).toHaveBeenCalledTimes(1);
});
