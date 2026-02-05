/**
 * HostControlButtons - Host-only control buttons for RoomScreen
 *
 * This component only handles button rendering based on visibility flags.
 * All business logic, dialogs, and service calls remain in RoomScreen.
 *
 * NOTE: BGM toggle has been moved to ConfigScreen (room creation/edit).
 */
import React, { useMemo, memo } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useColors, spacing, typography, borderRadius, type ThemeColors } from '../../theme';

export interface HostControlButtonsProps {
  // Visibility flags
  isHost: boolean;
  showSettings: boolean;
  showPrepareToFlip: boolean;
  showStartGame: boolean;
  showLastNightInfo: boolean;
  showRestart: boolean;

  // Debug mode visibility flags
  showFillWithBots: boolean;
  showMarkAllBotsViewed: boolean;

  // Button press handlers (parent provides dialog/logic)
  onSettingsPress: () => void;
  onPrepareToFlipPress: () => void;
  onStartGamePress: () => void;
  onLastNightInfoPress: () => void;
  onRestartPress: () => void;

  // Debug mode handlers
  onFillWithBotsPress: () => void;
  onMarkAllBotsViewedPress: () => void;
}

const HostControlButtonsComponent: React.FC<HostControlButtonsProps> = ({
  isHost,
  showSettings,
  showPrepareToFlip,
  showStartGame,
  showLastNightInfo,
  showRestart,
  showFillWithBots,
  showMarkAllBotsViewed,
  onSettingsPress,
  onPrepareToFlipPress,
  onStartGamePress,
  onLastNightInfoPress,
  onRestartPress,
  onFillWithBotsPress,
  onMarkAllBotsViewedPress,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!isHost) return null;

  return (
    <>
      {/* Host: Settings */}
      {showSettings && (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.info }]}
          onPress={onSettingsPress}
        >
          <Text style={styles.buttonText}>⚙️ 设置</Text>
        </TouchableOpacity>
      )}

      {/* Debug: Fill With Bots (only in unseated status) */}
      {showFillWithBots && (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.warning }]}
          onPress={onFillWithBotsPress}
        >
          <Text style={styles.buttonText}>🤖 填充机器人</Text>
        </TouchableOpacity>
      )}

      {/* Host: Prepare to Flip */}
      {showPrepareToFlip && (
        <TouchableOpacity style={styles.actionButton} onPress={onPrepareToFlipPress}>
          <Text style={styles.buttonText}>准备看牌</Text>
        </TouchableOpacity>
      )}

      {/* Debug: Mark All Bots Viewed (only in assigned status with bots) */}
      {showMarkAllBotsViewed && (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.warning }]}
          onPress={onMarkAllBotsViewedPress}
        >
          <Text style={styles.buttonText}>🤖 一键看牌</Text>
        </TouchableOpacity>
      )}

      {/* Host: Start Game */}
      {showStartGame && (
        <TouchableOpacity style={styles.actionButton} onPress={onStartGamePress}>
          <Text style={styles.buttonText}>开始游戏</Text>
        </TouchableOpacity>
      )}

      {/* Host: View Last Night Info */}
      {showLastNightInfo && (
        <TouchableOpacity style={styles.actionButton} onPress={onLastNightInfoPress}>
          <Text style={styles.buttonText}>查看昨晚信息</Text>
        </TouchableOpacity>
      )}

      {/* Host: Restart Game */}
      {showRestart && (
        <TouchableOpacity style={styles.actionButton} onPress={onRestartPress}>
          <Text style={styles.buttonText}>重新开始</Text>
        </TouchableOpacity>
      )}
    </>
  );
};

// Memoize to prevent unnecessary re-renders
export const HostControlButtons = memo(HostControlButtonsComponent);

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    actionButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.large,
      paddingVertical: spacing.medium,
      borderRadius: borderRadius.full,
      marginBottom: spacing.small,
    },
    buttonText: {
      color: colors.textInverse,
      fontSize: typography.secondary,
      fontWeight: '600',
    },
  });
}

export default HostControlButtons;
