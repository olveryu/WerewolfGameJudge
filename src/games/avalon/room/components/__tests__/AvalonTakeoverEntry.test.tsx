/** 局内机器人接管入口（D12）：房主中性浮钮 + 卡片接管/释放，无接管提示。 */

import type { AvalonViewModel } from '@game-judge/game-engine/games/avalon/public';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';

import { AvalonTakeoverEntry } from '../AvalonTakeoverEntry';

function mockViewModel(botSeats: { seat: number; displayName: string }[]): AvalonViewModel {
  return {
    phase: 'nominate',
    seats: botSeats.map((bot) => ({
      seat: bot.seat,
      displayName: bot.displayName,
      isBot: true,
      isLeader: false,
      role: null,
    })),
  } as unknown as AvalonViewModel;
}

const BOTS = [
  { seat: 1, displayName: '机器人2号' },
  { seat: 3, displayName: '机器人4号' },
];

function renderEntry({
  isHost = true,
  botSeats = BOTS,
  controlledSeat = null as number | null,
} = {}) {
  const onTakeOver = jest.fn();
  const onRelease = jest.fn();
  const utils = render(
    <AvalonTakeoverEntry
      isHost={isHost}
      viewModel={mockViewModel(botSeats)}
      controlledSeat={controlledSeat}
      onTakeOver={onTakeOver}
      onRelease={onRelease}
    />,
  );
  return { ...utils, onTakeOver, onRelease };
}

/** 打开底部卡片：点浮钮。 */
function openSheet(getByLabelText: (label: string) => ReactTestInstance) {
  fireEvent.press(getByLabelText('机器人接管，有 2 个机器人'));
}

describe('AvalonTakeoverEntry', () => {
  it('renders nothing for non-hosts', () => {
    const { queryByLabelText } = renderEntry({ isHost: false });
    expect(queryByLabelText('机器人接管，有 2 个机器人')).toBeNull();
  });

  it('renders nothing without bots', () => {
    const { queryByLabelText } = renderEntry({ botSeats: [] });
    expect(queryByLabelText(/机器人接管/)).toBeNull();
  });

  it('opens the sheet with neutral rows for the host', () => {
    const { getByLabelText, getByText, getAllByText } = renderEntry();
    openSheet(getByLabelText);
    expect(getByText('机器人接管')).toBeTruthy();
    // 全部中性"等待"，无"请接管"类提示。
    expect(getAllByText('等待')).toHaveLength(2);
    expect(getAllByText('接管代打')).toHaveLength(2);
  });

  it('takes over a bot seat from the sheet', () => {
    const { getByLabelText, getAllByText, onTakeOver, onRelease } = renderEntry();
    openSheet(getByLabelText);
    fireEvent.press(getAllByText('接管代打')[0]!);
    expect(onTakeOver).toHaveBeenCalledTimes(1);
    expect(onTakeOver).toHaveBeenCalledWith(1);
    expect(onRelease).not.toHaveBeenCalled();
  });

  it('releases the controlled seat with the neutral label', () => {
    const { getByLabelText, getByText, queryByText, onTakeOver, onRelease } = renderEntry({
      controlledSeat: 3,
    });
    openSheet(getByLabelText);
    // 被接管席位显示"停止代打"，其余仍是"接管代打"。
    expect(getByText('停止代打')).toBeTruthy();
    expect(queryByText('接管代打')).toBeTruthy();
    fireEvent.press(getByText('停止代打'));
    expect(onRelease).toHaveBeenCalledTimes(1);
    expect(onTakeOver).not.toHaveBeenCalled();
  });

  it('keeps the fab neutral and never urgent (D12)', () => {
    const { getByLabelText, queryByLabelText } = renderEntry();
    // isUrgent=false 时用中性文案；紧急文案"机器人需要接管…"绝不出现。
    expect(getByLabelText('机器人接管，有 2 个机器人')).toBeTruthy();
    expect(queryByLabelText('机器人需要接管，有 2 个机器人')).toBeNull();
  });
});
