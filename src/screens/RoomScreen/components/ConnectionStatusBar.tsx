/**
 * ConnectionStatusBar.tsx - Connection status indicator for non-host players
 *
 * Shows connection state and provides force sync button when disconnected.
 */
import React, { useMemo, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { TESTIDS } from '../../../testids';
import {
  useColors,
  spacing,
  typography,
  borderRadius,
  shadows,
  type ThemeColors,
} from '../../../theme';

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
const ConnectionStatusBarComponent: React.FC<ConnectionStatusBarProps> = ({
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

// Memoize to prevent unnecessary re-renders
export const ConnectionStatusBar = memo(ConnectionStatusBarComponent);

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.tight,
      paddingHorizontal: spacing.medium,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      marginHorizontal: spacing.medium,
      marginTop: spacing.small,
      ...shadows.sm,
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
      fontWeight: typography.weights.medium,
    },
    syncButton: {
      marginLeft: spacing.medium,
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.tight,
      backgroundColor: colors.primary,
      borderRadius: borderRadius.small,
    },
    syncButtonDisabled: {
      backgroundColor: colors.textMuted,
    },
    syncButtonText: {
      fontSize: typography.secondary,
      color: colors.textInverse,
      fontWeight: typography.weights.semibold,
    },
  });
}

export default ConnectionStatusBar;
