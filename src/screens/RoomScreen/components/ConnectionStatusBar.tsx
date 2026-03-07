/**
 * ConnectionStatusBar - 断线横幅（Memoized）
 *
 * 仅在非 Live 状态时显示 "连接断开，正在重连..."。
 * Dead channel detector 会无限 5s 重试，无需手动重试按钮。
 * Live 时不渲染任何内容。社区标准做法：只在出问题时提示。
 */
import React, { memo } from 'react';
import { Text, View } from 'react-native';

import { ConnectionStatus } from '@/services/types/IGameFacade';
import { TESTIDS } from '@/testids';

import { type ConnectionStatusBarStyles } from './styles';

interface ConnectionStatusBarProps {
  /** Current connection state */
  status: ConnectionStatus;
  /** Pre-created styles from parent */
  styles: ConnectionStatusBarStyles;
}

/**
 * Disconnection banner — only rendered when not connected.
 */
const ConnectionStatusBarComponent: React.FC<ConnectionStatusBarProps> = ({ status, styles }) => {
  if (status === ConnectionStatus.Live) return null;

  return (
    <View style={styles.container} testID={TESTIDS.connectionStatusContainer}>
      <Text style={styles.text}>连接断开，正在重连...</Text>
    </View>
  );
};

export const ConnectionStatusBar = memo(ConnectionStatusBarComponent);

ConnectionStatusBar.displayName = 'ConnectionStatusBar';
