/**
 * HostControlButtons - Host-only control buttons for RoomScreen
 *
 * This component only handles button rendering based on visibility flags.
 * All business logic, dialogs, and service calls remain in RoomScreen.
 */
import React, { useMemo } from 'react';
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
  showBgmToggle: boolean;

  // BGM state
  isBgmEnabled: boolean;

  // Button press handlers (parent provides dialog/logic)
  onSettingsPress: () => void;
  onPrepareToFlipPress: () => void;
  onStartGamePress: () => void;
  onLastNightInfoPress: () => void;
  onRestartPress: () => void;
  onBgmToggle: () => void;
}

export const HostControlButtons: React.FC<HostControlButtonsProps> = ({
  isHost,
  showSettings,
  showPrepareToFlip,
  showStartGame,
  showLastNightInfo,
  showRestart,
  showBgmToggle,
  isBgmEnabled,
  onSettingsPress,
  onPrepareToFlipPress,
  onStartGamePress,
  onLastNightInfoPress,
  onRestartPress,
  onBgmToggle,
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

      {/* Host: BGM Toggle */}
      {showBgmToggle && (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.primaryDark }]}
          onPress={onBgmToggle}
        >
          <Text style={styles.buttonText}>{isBgmEnabled ? '🎵 关闭音乐' : '🔇 开启音乐'}</Text>
        </TouchableOpacity>
      )}

      {/* Host: Prepare to Flip */}
      {showPrepareToFlip && (
        <TouchableOpacity style={styles.actionButton} onPress={onPrepareToFlipPress}>
          <Text style={styles.buttonText}>准备看牌</Text>
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

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    actionButton: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: borderRadius.full,
      marginBottom: spacing.sm,
    },
    buttonText: {
      color: colors.textInverse,
      fontSize: typography.sm,
      fontWeight: '600',
    },
  });
}

export default HostControlButtons;
