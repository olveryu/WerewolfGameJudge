/**
 * HostControlButtons - Host 专属控制按钮组（Memoized）
 *
 * 仅负责按 visibility flags 渲染按钮，业务逻辑由 RoomScreen 处理。
 * 渲染 UI 并通过回调上报 onPress，不 import service，不包含业务逻辑判断。
 * 样式由父组件通过 props 注入（actionStyles / dangerStyles），不自建 StyleSheet。
 */
import { Ionicons } from '@expo/vector-icons';
import React, { memo } from 'react';
import { Text, TouchableOpacity } from 'react-native';

import { TESTIDS } from '@/testids';
import { useColors } from '@/theme';

import type { ActionButtonStyles } from './styles';

interface HostControlButtonsProps {
  // Visibility flags
  isHost: boolean;
  showSettings: boolean;
  showPrepareToFlip: boolean;
  showStartGame: boolean;
  showRestart: boolean;
  /** Disable all action buttons while a host action is in-flight. */
  disabled?: boolean;
  /** Pre-created styles for normal buttons (from parent componentStyles.actionButton). */
  actionStyles: ActionButtonStyles;
  /** Pre-created styles for danger buttons (from parent componentStyles.dangerActionButton). */
  dangerStyles: ActionButtonStyles;

  // Button press handlers (parent provides dialog/logic)
  onSettingsPress: () => void;
  onPrepareToFlipPress: () => void;
  onStartGamePress: () => void;
  onRestartPress: () => void;
}

const HostControlButtonsComponent: React.FC<HostControlButtonsProps> = ({
  isHost,
  showSettings,
  showPrepareToFlip,
  showStartGame,
  showRestart,
  disabled,
  actionStyles,
  dangerStyles,
  onSettingsPress,
  onPrepareToFlipPress,
  onStartGamePress,
  onRestartPress,
}) => {
  const colors = useColors();

  if (!isHost) return null;

  return (
    <>
      {/* Host: Restart Game - danger style (leftmost) */}
      {showRestart && (
        <TouchableOpacity
          style={[dangerStyles.actionButton, disabled && dangerStyles.disabledButton]}
          onPress={onRestartPress}
          disabled={disabled}
        >
          <Text style={dangerStyles.buttonText}>重开</Text>
        </TouchableOpacity>
      )}

      {/* Host: Settings */}
      {showSettings && (
        <TouchableOpacity
          style={[actionStyles.actionButton, { backgroundColor: colors.info }]}
          onPress={onSettingsPress}
          testID={TESTIDS.roomSettingsButton}
        >
          <Text style={actionStyles.buttonText}>
            <Ionicons name="settings-outline" size={14} color={colors.textInverse} />
            {' 设置'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Host: Prepare to Flip */}
      {showPrepareToFlip && (
        <TouchableOpacity
          style={[actionStyles.actionButton, disabled && actionStyles.disabledButton]}
          onPress={onPrepareToFlipPress}
          disabled={disabled}
        >
          <Text style={actionStyles.buttonText}>准备看牌</Text>
        </TouchableOpacity>
      )}

      {/* Host: Start Game */}
      {showStartGame && (
        <TouchableOpacity
          style={[actionStyles.actionButton, disabled && actionStyles.disabledButton]}
          onPress={onStartGamePress}
          disabled={disabled}
        >
          <Text style={actionStyles.buttonText}>开始游戏</Text>
        </TouchableOpacity>
      )}
    </>
  );
};

// Memoize to prevent unnecessary re-renders
export const HostControlButtons = memo(HostControlButtonsComponent);
