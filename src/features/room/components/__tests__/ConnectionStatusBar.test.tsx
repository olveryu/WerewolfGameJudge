import { fireEvent, render } from '@testing-library/react-native';

import { ConnectionStatusBar } from '@/features/room/components/ConnectionStatusBar';
import type { ConnectionStatusBarStyles } from '@/features/room/components/styles';

const styles: ConnectionStatusBarStyles = {
  container: {},
  text: {},
  progressBarTrack: {},
  progressBar: {},
  failedRow: {},
  reconnectButton: {},
  reconnectText: {},
};

describe('ConnectionStatusBar', () => {
  it('shows authoritative confirmation progress while the connection is live', () => {
    const screen = render(
      <ConnectionStatusBar
        status="live"
        pendingCommandCount={1}
        onManualReconnect={jest.fn()}
        styles={styles}
      />,
    );

    expect(screen.getByText('正在确认提交结果')).toBeTruthy();
  });

  it('explains that a pending action is saved while reconnecting', () => {
    const screen = render(
      <ConnectionStatusBar
        status="connecting"
        pendingCommandCount={1}
        onManualReconnect={jest.fn()}
        styles={styles}
      />,
    );

    expect(screen.getByText('行动已保存，重连后将自动确认')).toBeTruthy();
  });

  it('retains manual reconnect without presenting the action as lost', () => {
    const onManualReconnect = jest.fn();
    const screen = render(
      <ConnectionStatusBar
        status="failed"
        pendingCommandCount={1}
        onManualReconnect={onManualReconnect}
        styles={styles}
      />,
    );

    expect(screen.getByText('行动已保存，重连后继续确认')).toBeTruthy();
    fireEvent.press(screen.getByText('点击重连'));
    expect(onManualReconnect).toHaveBeenCalledTimes(1);
  });

  it('renders nothing for a live connection without pending commands', () => {
    const screen = render(
      <ConnectionStatusBar
        status="live"
        pendingCommandCount={0}
        onManualReconnect={jest.fn()}
        styles={styles}
      />,
    );

    expect(screen.toJSON()).toBeNull();
  });
});
