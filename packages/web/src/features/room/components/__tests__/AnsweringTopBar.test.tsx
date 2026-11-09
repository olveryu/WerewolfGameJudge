/**
 * The shared answering top bar (v3): countdown ring, seat avatars with
 * submitted state, and the answering/submitted counts — identical for
 * Story Relay and Pictionary.
 */

import { render, screen } from '@testing-library/react';

import { colors } from '@/theme/colors';

import type { AnsweringTopBarSeat } from '../../model/answeringTopBarSeats';
import { AnsweringTopBar } from '../AnsweringTopBar';

// Room 5208 snapshot: 6 seats, JY and 文森特 submitted, 82 of 90 seconds left.
const seats: AnsweringTopBarSeat[] = [
  { seat: 0, displayName: 'JY', initial: 'JY', color: '#7C6FF0', submitted: true },
  { seat: 1, displayName: '文森特', initial: '文', color: '#F59E0B', submitted: true },
  { seat: 2, displayName: '匿名玩家', initial: '匿', color: '#94A3B8', submitted: false },
  { seat: 3, displayName: '不是倒钩狼', initial: '不', color: '#0EA5A4', submitted: false },
  { seat: 4, displayName: '王小躁', initial: '王', color: '#EC4899', submitted: false },
  { seat: 5, displayName: '严振宇', initial: '严', color: '#6366F1', submitted: false },
];

const renderBar = (
  remainingSeconds: number | null,
  totalSeconds: number | null,
  list: readonly AnsweringTopBarSeat[] = seats,
) =>
  render(
    <AnsweringTopBar
      remainingSeconds={remainingSeconds}
      totalSeconds={totalSeconds}
      seats={list}
    />,
  );

const arc = () => screen.getByTestId('answering-top-bar-ring-arc');

const expectDot = (seat: number, color: string) =>
  expect(screen.getByTestId(`answering-top-bar-dot-${seat}`)).toHaveStyle({
    backgroundColor: color,
  });

describe('AnsweringTopBar', () => {
  it('shows the v3 snapshot: 82 of 90 seconds, 4 answering, 2 submitted', () => {
    renderBar(82, 90);
    expect(screen.getByText('82')).toBeInTheDocument();
    expect(screen.getByText('秒')).toBeInTheDocument();
    // Ring arc: 94.2 × (1 − 82/90) ≈ 8.37.
    expect(Number(arc().getAttribute('stroke-dashoffset'))).toBeCloseTo(94.2 * (1 - 82 / 90), 2);
    expect(arc()).toHaveAttribute('stroke', '#6366F1');
    expect(screen.getByText('4人作答中')).toBeInTheDocument();
    expect(screen.getByText(/2已提交/)).toBeInTheDocument();
    expect(screen.getByText('JY')).toBeInTheDocument();
    expect(screen.getByText('文')).toBeInTheDocument();
    expect(screen.getByText('匿')).toBeInTheDocument();
    expect(screen.getAllByTestId('answering-top-bar-ready-ring')).toHaveLength(2);
    expectDot(0, '#22C55E');
    expectDot(2, '#6366F1');
    expect(screen.getByRole('group', { name: '作答进度：4人作答中，2人已提交' })).toBe(
      screen.getByTestId('answering-top-bar'),
    );
  });

  it('shows 不限时 with no arc when there is no time limit', () => {
    renderBar(null, null);
    expect(screen.getByText('不限时')).toBeInTheDocument();
    expect(screen.queryByTestId('answering-top-bar-ring-arc')).toBeNull();
    expect(screen.getByTestId('answering-top-bar-ring')).toHaveAccessibleName('本阶段不限时');
  });

  it('shows 0秒 with an empty arc at zero seconds', () => {
    renderBar(0, 90);
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(Number(arc().getAttribute('stroke-dashoffset'))).toBeCloseTo(94.2, 2);
    expect(arc()).toHaveAttribute('stroke', '#6366F1');
  });

  it('turns the arc red at 10 seconds or less, and keeps it indigo above that', () => {
    const view = renderBar(10, 90);
    expect(arc()).toHaveAttribute('stroke', colors.error);
    view.unmount();
    renderBar(11, 90);
    expect(arc()).toHaveAttribute('stroke', '#6366F1');
  });

  it('shows 8 avatars plus a +N circle when there are more than 8 seats', () => {
    const many: AnsweringTopBarSeat[] = Array.from({ length: 10 }, (_, index) => ({
      seat: index,
      displayName: `p${index}`,
      initial: `${index}`,
      color: '#7C6FF0',
      submitted: index < 3,
    }));
    renderBar(45, 90, many);
    expect(screen.getByTestId('answering-top-bar-avatar-7')).toBeInTheDocument();
    expect(screen.queryByTestId('answering-top-bar-avatar-8')).toBeNull();
    expect(screen.getByTestId('answering-top-bar-overflow')).toHaveAccessibleName('还有 2 人');
    expect(screen.getByText('+2')).toBeInTheDocument();
    expect(screen.getByText('7人作答中')).toBeInTheDocument();
    expect(screen.getByText(/3已提交/)).toBeInTheDocument();
  });

  it('shows zero counts with no seats', () => {
    renderBar(45, 90, []);
    expect(screen.getByText('0人作答中')).toBeInTheDocument();
    expect(screen.getByText(/0已提交/)).toBeInTheDocument();
  });

  it('keys avatars by seat so two unnamed players both render', () => {
    const unnamed: AnsweringTopBarSeat[] = [
      { seat: 0, displayName: '匿名玩家', initial: '匿', color: '#7C6FF0', submitted: true },
      { seat: 1, displayName: '匿名玩家', initial: '匿', color: '#F59E0B', submitted: false },
    ];
    renderBar(45, 90, unnamed);
    expect(screen.getByTestId('answering-top-bar-avatar-0')).toHaveAccessibleName(
      '匿名玩家：已提交',
    );
    expect(screen.getByTestId('answering-top-bar-avatar-1')).toHaveAccessibleName(
      '匿名玩家：作答中',
    );
    expectDot(0, '#22C55E');
    expectDot(1, '#6366F1');
  });
});
