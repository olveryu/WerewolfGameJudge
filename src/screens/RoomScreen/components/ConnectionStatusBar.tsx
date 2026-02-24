/**
 * ConnectionStatusBar - 连接状态指示器（Memoized）
 *
 * 显示连接状态 + 强制同步按钮（非 Host 玩家用）。
 * 渲染 UI 并通过回调上报 onForceSync，不 import service，不包含业务逻辑判断。
 */
import React, { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { ConnectionStatus } from '@/services/types/IGameFacade';
import { TESTIDS } from '@/testids';

import { type ConnectionStatusBarStyles } from './styles';

interface ConnectionStatusBarProps {
  /** Current connection state */
  status: ConnectionStatus;
  /** Callback for force sync button */
  onForceSync?: () => void;
  /** Pre-created styles from parent */
  styles: ConnectionStatusBarStyles;
}

/**
 * Connection status bar shown to non-host players
 */
const ConnectionStatusBarComponent: React.FC<ConnectionStatusBarProps> = ({
  status,
  onForceSync,
  styles,
}) => {
  const getStatusStyle = () => {
    switch (status) {
      case ConnectionStatus.Live:
        return styles.statusLive;
      case ConnectionStatus.Syncing:
        return styles.statusSyncing;
      case ConnectionStatus.Connecting:
        return styles.statusConnecting;
      case ConnectionStatus.Disconnected:
        return styles.statusDisconnected;
      default:
        return undefined;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case ConnectionStatus.Live:
        return '🟢 已连接';
      case ConnectionStatus.Syncing:
        return '🔄 同步中...';
      case ConnectionStatus.Connecting:
        return '⏳ 连接中...';
      case ConnectionStatus.Disconnected:
        return '🔴 连接断开';
      default:
        return '';
    }
  };

  const showSyncButton =
    status === ConnectionStatus.Disconnected ||
    status === ConnectionStatus.Syncing ||
    status === ConnectionStatus.Connecting;
  const isSyncing = status === ConnectionStatus.Syncing || status === ConnectionStatus.Connecting;

  return (
    <View style={[styles.container, getStatusStyle()]} testID={TESTIDS.connectionStatusContainer}>
      <Text style={styles.statusText}>{getStatusText()}</Text>
      {showSyncButton && onForceSync && (
        <TouchableOpacity
          onPress={() => {
            // Always report intent; caller decides whether to act
            // Syncing state is visible in UI, orchestrator can ignore if needed
            onForceSync();
          }}
          style={[styles.syncButton, isSyncing && styles.syncButtonDisabled]}
          activeOpacity={isSyncing ? 1 : 0.7}
          accessibilityState={{ disabled: isSyncing }}
          testID={TESTIDS.forceSyncButton}
        >
          <Text style={styles.syncButtonText}>{isSyncing ? '同步中' : '强制同步'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export const ConnectionStatusBar = memo(ConnectionStatusBarComponent);

ConnectionStatusBar.displayName = 'ConnectionStatusBar';
