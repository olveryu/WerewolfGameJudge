import { act, fireEvent, render } from '@testing-library/react-native';

import { ConnectionStatusBar } from '@/features/room/components/ConnectionStatusBar';
import type { ConnectionStatusBarStyles } from '@/features/room/components/styles';
import type { LinkStatus } from '@/platform/realtime/types';
import { TESTIDS } from '@/testids';

const styles: ConnectionStatusBarStyles = {
  container: {},
  text: {},
  progressBarTrack: {},
  progressBar: {},
  failedRow: {},
  reconnectButton: {},
  reconnectText: {},
};

function renderBar(status: LinkStatus, pendingDurableCount = 0, now = () => 0) {
  const onRetryNow = jest.fn();
  const screen = render(
    <ConnectionStatusBar
      status={status}
      pendingDurableCount={pendingDurableCount}
      onRetryNow={onRetryNow}
      styles={styles}
      now={now}
    />,
  );
  return { screen, onRetryNow };
}

describe('ConnectionStatusBar', () => {
  it('renders nothing while live with no pending durable command', () => {
    const { screen } = renderBar({ kind: 'live' });
    expect(screen.toJSON()).toBeNull();
  });

  it('uses the pending container, not the disconnected one, while live with pending commands', () => {
    const { screen } = renderBar({ kind: 'live' }, 1);
    expect(screen.getByTestId(TESTIDS.connectionPendingContainer)).toBeTruthy();
    expect(screen.queryByTestId(TESTIDS.connectionStatusContainer)).toBeNull();
    expect(screen.getByText('正在确认提交结果')).toBeTruthy();
  });

  it('explains that a pending action is saved while connecting', () => {
    const { screen } = renderBar({ kind: 'connecting', attempt: 1 }, 1);
    expect(screen.getByTestId(TESTIDS.connectionStatusContainer)).toBeTruthy();
    expect(screen.getByText('行动已保存，连接后将自动确认')).toBeTruthy();
  });

  it('counts down to the next retry and lets the user reconnect now', () => {
    let nowMs = 10_000;
    const { screen, onRetryNow } = renderBar(
      { kind: 'waiting', cause: 'backoff', attempt: 2, nextRetryAtMs: 13_400 },
      0,
      () => nowMs,
    );
    expect(screen.getByText('连接断开，4 秒后重试')).toBeTruthy();

    nowMs = 12_900;
    act(() => {
      jest.advanceTimersByTime(250);
    });
    expect(screen.getByText('连接断开，1 秒后重试')).toBeTruthy();

    fireEvent.press(screen.getByTestId(TESTIDS.connectionRetryNowButton));
    expect(onRetryNow).toHaveBeenCalledTimes(1);
  });

  it('names what the link is waiting for when offline or hidden', () => {
    expect(
      renderBar({
        kind: 'waiting',
        cause: 'offline',
        attempt: 1,
        nextRetryAtMs: null,
      }).screen.getByText('网络已断开，恢复后自动重连'),
    ).toBeTruthy();
    expect(
      renderBar({
        kind: 'waiting',
        cause: 'hidden',
        attempt: 1,
        nextRetryAtMs: null,
      }).screen.getByText('应用在后台，返回后自动重连'),
    ).toBeTruthy();
  });

  it('shows the terminal reason without a retry button', () => {
    const { screen } = renderBar({ kind: 'closed', reason: 'roomDeleted' });
    expect(screen.getByText('房间已过期关闭')).toBeTruthy();
    expect(screen.queryByTestId(TESTIDS.connectionRetryNowButton)).toBeNull();
  });
});

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.useRealTimers();
});
