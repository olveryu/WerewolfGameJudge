/**
 * The shared answering top bar (v3): countdown ring, seat avatars with
 * submitted state, and the answering/submitted counts — identical for
 * Story Relay and Pictionary.
 */

import { render } from '@testing-library/react-native';
import { processColor, StyleSheet, type ViewStyle } from 'react-native';

import { colors } from '@/theme';

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

const bar = (
  remainingSeconds: number | null,
  totalSeconds: number | null,
  list: readonly AnsweringTopBarSeat[] = seats,
) => (
  <AnsweringTopBar remainingSeconds={remainingSeconds} totalSeconds={totalSeconds} seats={list} />
);

const arcProps = (view: ReturnType<typeof render>) =>
  view.getByTestId('answering-top-bar-ring-arc').props;

/** react-native-svg processes the stroke into a colour object whose payload is the processColor number. */
const expectArcStroke = (view: ReturnType<typeof render>, color: string) => {
  const stroke = arcProps(view).stroke as { readonly payload: number };
  expect(stroke.payload).toBe(processColor(color));
};

const dotBackground = (view: ReturnType<typeof render>, seat: number) => {
  const style = StyleSheet.flatten(
    view.getByTestId(`answering-top-bar-dot-${seat}`).props.style as ViewStyle,
  );
  return style.backgroundColor;
};

describe('AnsweringTopBar', () => {
  it('shows the v3 snapshot: 82 of 90 seconds, 4 answering, 2 submitted', () => {
    const view = render(bar(82, 90));
    expect(view.getByTestId('answering-top-bar')).toBeTruthy();
    expect(view.getByText('82')).toBeTruthy();
    expect(view.getByText('秒')).toBeTruthy();
    // Ring arc: 94.2 × (1 − 82/90) ≈ 8.37.
    expect(arcProps(view).strokeDashoffset).toBeCloseTo(94.2 * (1 - 82 / 90), 2);
    expectArcStroke(view, '#6366F1');
    expect(view.getByText('4人作答中')).toBeTruthy();
    expect(view.getByText(/2已提交/)).toBeTruthy();
    expect(view.getByText('JY')).toBeTruthy();
    expect(view.getByText('文')).toBeTruthy();
    expect(view.getByText('匿')).toBeTruthy();
    expect(view.getAllByTestId('answering-top-bar-ready-ring')).toHaveLength(2);
    expect(dotBackground(view, 0)).toBe('#22C55E');
    expect(dotBackground(view, 2)).toBe('#6366F1');
    expect(view.getByTestId('answering-top-bar').props.accessibilityLabel).toBe(
      '作答进度：4人作答中，2人已提交',
    );
  });

  it('shows 不限时 with no arc when there is no time limit', () => {
    const view = render(bar(null, null));
    expect(view.getByText('不限时')).toBeTruthy();
    expect(view.queryByTestId('answering-top-bar-ring-arc')).toBeNull();
    expect(view.getByTestId('answering-top-bar-ring').props.accessibilityLabel).toBe(
      '本阶段不限时',
    );
  });

  it('shows 0秒 with an empty arc at zero seconds', () => {
    const view = render(bar(0, 90));
    expect(view.getByText('0')).toBeTruthy();
    expect(arcProps(view).strokeDashoffset).toBeCloseTo(94.2, 2);
    expectArcStroke(view, '#6366F1');
  });

  it('turns the arc red at 10 seconds or less, and keeps it indigo above that', () => {
    expectArcStroke(render(bar(10, 90)), colors.error);
    expectArcStroke(render(bar(11, 90)), '#6366F1');
  });

  it('shows 8 avatars plus a +N circle when there are more than 8 seats', () => {
    const many: AnsweringTopBarSeat[] = Array.from({ length: 10 }, (_, index) => ({
      seat: index,
      displayName: `p${index}`,
      initial: `${index}`,
      color: '#7C6FF0',
      submitted: index < 3,
    }));
    const view = render(bar(45, 90, many));
    expect(view.getByTestId('answering-top-bar-avatar-7')).toBeTruthy();
    expect(view.queryByTestId('answering-top-bar-avatar-8')).toBeNull();
    expect(view.getByTestId('answering-top-bar-overflow')).toBeTruthy();
    expect(view.getByText('+2')).toBeTruthy();
    expect(view.getByText('7人作答中')).toBeTruthy();
    expect(view.getByText(/3已提交/)).toBeTruthy();
  });

  it('shows zero counts with no seats', () => {
    const view = render(bar(45, 90, []));
    expect(view.getByText('0人作答中')).toBeTruthy();
    expect(view.getByText(/0已提交/)).toBeTruthy();
  });

  it('renders two unnamed players without a duplicate-key warning', () => {
    const consoleError = jest.spyOn(console, 'error');
    consoleError.mockClear();
    const unnamed: AnsweringTopBarSeat[] = [
      { seat: 0, displayName: '匿名玩家', initial: '匿', color: '#7C6FF0', submitted: true },
      { seat: 1, displayName: '匿名玩家', initial: '匿', color: '#F59E0B', submitted: false },
    ];
    const view = render(bar(45, 90, unnamed));
    expect(view.getByTestId('answering-top-bar-avatar-0')).toBeTruthy();
    expect(view.getByTestId('answering-top-bar-avatar-1')).toBeTruthy();
    expect(dotBackground(view, 0)).toBe('#22C55E');
    expect(dotBackground(view, 1)).toBe('#6366F1');
    const duplicateKeyWarnings = consoleError.mock.calls.filter(
      ([message]) => typeof message === 'string' && message.includes('same key'),
    );
    expect(duplicateKeyWarnings).toHaveLength(0);
  });
});
