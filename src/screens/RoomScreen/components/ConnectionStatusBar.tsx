/**
 * ConnectionStatusBar.tsx - Connection status indicator for non-host players
 *
 * Shows connection state and provides force sync button when disconnected.
 */
import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TESTIDS } from '../../../testids';
import { useColors, spacing, typography, borderRadius, type ThemeColors } from '../../../theme';

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
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

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

  return (
    <View style={[styles.container, getStatusStyle()]} testID={TESTIDS.connectionStatusContainer}>
      <Text style={styles.statusText}>{getStatusText()}</Text>
      {showSyncButton && onForceSync && (
        <TouchableOpacity
          onPress={onForceSync}
          style={styles.syncButton}
          disabled={status === 'syncing'}
          testID={TESTIDS.forceSyncButton}
        >
          <Text style={styles.syncButtonText}>{status === 'syncing' ? '同步中' : '强制同步'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.tight,
      paddingHorizontal: spacing.medium,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    statusLive: {
      backgroundColor: colors.success + '20',
    },
    statusSyncing: {
      backgroundColor: colors.warning + '20',
    },
    statusConnecting: {
      backgroundColor: colors.info + '20',
    },
    statusDisconnected: {
      backgroundColor: colors.error + '20',
    },
    statusText: {
      fontSize: typography.secondary,
      color: colors.text,
      fontWeight: '500',
    },
    syncButton: {
      marginLeft: spacing.medium,
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.tight,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.small,
    },
    syncButtonText: {
      fontSize: typography.secondary,
      color: colors.textInverse,
      fontWeight: '600',
    },
  });
}

export default ConnectionStatusBar;
