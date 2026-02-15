/**
 * HostControlButtons - Host 专属控制按钮组（Memoized）
 *
 * 仅负责按 visibility flags 渲染按钮，业务逻辑由 RoomScreen 处理。
 *
 * ✅ 允许：渲染 UI + 上报 onPress 回调
 * ❌ 禁止：import service / 业务逻辑判断
 */
import { Ionicons } from '@expo/vector-icons';
import React, { memo, useMemo } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';

import { TESTIDS } from '@/testids';
import { borderRadius, spacing, type ThemeColors, typography, useColors } from '@/theme';

interface HostControlButtonsProps {
  // Visibility flags
  isHost: boolean;
  showSettings: boolean;
  showPrepareToFlip: boolean;
  showStartGame: boolean;
  showLastNightInfo: boolean;
  showRestart: boolean;
  /** Disable all action buttons while a host action is in-flight. */
  disabled?: boolean;

  // Button press handlers (parent provides dialog/logic)
  onSettingsPress: () => void;
  onPrepareToFlipPress: () => void;
  onStartGamePress: () => void;
  onLastNightInfoPress: () => void;
  onRestartPress: () => void;
}

const HostControlButtonsComponent: React.FC<HostControlButtonsProps> = ({
  isHost,
  showSettings,
  showPrepareToFlip,
  showStartGame,
  showLastNightInfo,
  showRestart,
  disabled,
  onSettingsPress,
  onPrepareToFlipPress,
  onStartGamePress,
  onLastNightInfoPress,
  onRestartPress,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!isHost) return null;

  return (
    <>
      {/* Host: Restart Game - danger style (leftmost) */}
      {showRestart && (
        <TouchableOpacity
          style={[styles.actionButton, styles.restartButton, disabled && styles.disabledButton]}
          onPress={onRestartPress}
          disabled={disabled}
        >
          <Text style={styles.buttonText}>重开</Text>
        </TouchableOpacity>
      )}

      {/* Host: Settings */}
      {showSettings && (
        <TouchableOpacity
          style={[styles.actionButton, { backgroundColor: colors.info }]}
          onPress={onSettingsPress}
          testID={TESTIDS.roomSettingsButton}
        >
          <Text style={styles.buttonText}>
            <Ionicons name="settings-outline" size={14} color={colors.textInverse} />
            {' 设置'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Host: Prepare to Flip */}
      {showPrepareToFlip && (
        <TouchableOpacity
          style={[styles.actionButton, disabled && styles.disabledButton]}
          onPress={onPrepareToFlipPress}
          disabled={disabled}
        >
          <Text style={styles.buttonText}>准备看牌</Text>
        </TouchableOpacity>
      )}

      {/* Host: Start Game */}
      {showStartGame && (
        <TouchableOpacity
          style={[styles.actionButton, disabled && styles.disabledButton]}
          onPress={onStartGamePress}
          disabled={disabled}
        >
          <Text style={styles.buttonText}>开始游戏</Text>
        </TouchableOpacity>
      )}

      {/* Host: View Last Night Info */}
      {showLastNightInfo && (
        <TouchableOpacity
          style={[styles.actionButton, disabled && styles.disabledButton]}
          onPress={onLastNightInfoPress}
          disabled={disabled}
        >
          <Text style={styles.buttonText}>查看昨晚信息</Text>
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
    restartButton: {
      backgroundColor: colors.error,
    },
    disabledButton: {
      opacity: 0.5,
    },
    buttonText: {
      color: colors.textInverse,
      fontSize: typography.secondary,
      fontWeight: typography.weights.semibold,
    },
  });
}
