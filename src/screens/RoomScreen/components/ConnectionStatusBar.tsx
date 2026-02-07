/**
 * ConnectionStatusBar.tsx - Connection status indicator for non-host players
 *
 * Shows connection state and provides force sync button when disconnected.
 *
 * Performance: Memoized, receives pre-created styles from parent.
 */
import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { TESTIDS } from '../../../testids';
import { type ConnectionStatusBarStyles } from './styles';

export type ConnectionState = 'live' | 'syncing' | 'connecting' | 'disconnected';

export interface ConnectionStatusBarProps {
  /** Current connection state */
  status: ConnectionState;
  /** Callback for force sync button */
  onForceSync?: () => void;
  /** Pre-created styles from parent */
  styles: ConnectionStatusBarStyles;
}

function arePropsEqual(prev: ConnectionStatusBarProps, next: ConnectionStatusBarProps): boolean {
  return prev.status === next.status && prev.styles === next.styles;
  // onForceSync excluded - stable via useCallback
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
      case 'live':
        return styles.statusLive;
      case 'syncing':
        return styles.statusSyncing;
      case 'connecting':
        return styles.statusConnecting;
      case 'disconnected':
        return styles.statusDisconnected;
      default:
        return undefined;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'live':
        return '🟢 已连接';
      case 'syncing':
        return '🔄 同步中...';
      case 'connecting':
        return '⏳ 连接中...';
      case 'disconnected':
        return '🔴 连接断开';
      default:
        return '';
    }
  };

  const showSyncButton = status === 'disconnected' || status === 'syncing';
  const isSyncing = status === 'syncing';

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

export const ConnectionStatusBar = memo(ConnectionStatusBarComponent, arePropsEqual);

ConnectionStatusBar.displayName = 'ConnectionStatusBar';
