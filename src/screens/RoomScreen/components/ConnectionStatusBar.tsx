/**
 * ConnectionStatusBar - 断线横幅（Memoized）
 *
 * 仅在非 Live 状态时显示断线横幅。
 * - 自动重连中 → "连接断开，正在重连..."
 * - 重试耗尽 → "连接已断开" + 手动重试按钮
 * Live 时不渲染任何内容。社区标准做法：只在出问题时提示。
 */
import React, { memo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { ConnectionStatus } from '@/services/types/IGameFacade';
import { TESTIDS } from '@/testids';

import { type ConnectionStatusBarStyles } from './styles';

interface ConnectionStatusBarProps {
  /** Current connection state */
  status: ConnectionStatus;
  /** True when auto-reconnect retries are exhausted */
  retriesExhausted: boolean;
  /** Callback to manually trigger reconnection */
  onRetry: () => void;
  /** Pre-created styles from parent */
  styles: ConnectionStatusBarStyles;
}

/**
 * Disconnection banner — only rendered when not connected.
 */
const ConnectionStatusBarComponent: React.FC<ConnectionStatusBarProps> = ({
  status,
  retriesExhausted,
  onRetry,
  styles,
}) => {
  if (status === ConnectionStatus.Live) return null;

  return (
    <View style={styles.container} testID={TESTIDS.connectionStatusContainer}>
      <Text style={styles.text}>{retriesExhausted ? '连接已断开' : '连接断开，正在重连...'}</Text>
      {retriesExhausted && <Text style={styles.subtitleText}>请检查网络连接</Text>}
      {retriesExhausted && (
        <Pressable
          style={styles.retryButton}
          onPress={onRetry}
          testID={TESTIDS.connectionStatusContainer + '-retry'}
        >
          <Text style={styles.retryButtonText}>🔄 点击重试</Text>
        </Pressable>
      )}
    </View>
  );
};

export const ConnectionStatusBar = memo(ConnectionStatusBarComponent);

ConnectionStatusBar.displayName = 'ConnectionStatusBar';
