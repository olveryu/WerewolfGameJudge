/**
 * ConnectionStatusBar.tsx - Connection status indicator for non-host players
 *
 * Shows connection state and provides force sync button when disconnected.
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TESTIDS } from '../../../testids';
import { colors, spacing, borderRadius, typography } from '../../../constants/theme';

export type ConnectionState = 'live' | 'syncing' | 'connecting' | 'disconnected';

export interface ConnectionStatusBarProps {
  /** Current connection state */
  status: ConnectionState;
  /** Callback for force sync button */
  onForceSync?: () => void;
}

/**
 * Connection status bar shown to non-host players
 */
export const ConnectionStatusBar: React.FC<ConnectionStatusBarProps> = ({
  status,
  onForceSync,
}) => {
  const getStatusStyle = () => {
    switch (status) {
      case 'live': return styles.statusLive;
      case 'syncing': return styles.statusSyncing;
      case 'connecting': return styles.statusConnecting;
      case 'disconnected': return styles.statusDisconnected;
      default: return undefined;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'live': return '🟢 已连接';
      case 'syncing': return '🔄 同步中...';
      case 'connecting': return '⏳ 连接中...';
      case 'disconnected': return '🔴 连接断开';
      default: return '';
    }
  };

  const showSyncButton = status === 'disconnected' || status === 'syncing';

  return (
    <View 
      style={[styles.container, getStatusStyle()]} 
      testID={TESTIDS.connectionStatusContainer}
    >
      <Text style={styles.statusText}>{getStatusText()}</Text>
      {showSyncButton && onForceSync && (
        <TouchableOpacity
          onPress={onForceSync}
          style={styles.syncButton}
          disabled={status === 'syncing'}
          testID={TESTIDS.forceSyncButton}
        >
          <Text style={styles.syncButtonText}>
            {status === 'syncing' ? '同步中' : '强制同步'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  statusLive: {
    backgroundColor: '#E8F5E9',
  },
  statusSyncing: {
    backgroundColor: '#FFF8E1',
  },
  statusConnecting: {
    backgroundColor: '#E3F2FD',
  },
  statusDisconnected: {
    backgroundColor: '#FFEBEE',
  },
  statusText: {
    fontSize: typography.sm,
    color: colors.text,
    fontWeight: '500',
  },
  syncButton: {
    marginLeft: spacing.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.sm,
  },
  syncButtonText: {
    fontSize: typography.sm,
    color: '#FFFFFF',
    fontWeight: '600',
  },
});

export default ConnectionStatusBar;
