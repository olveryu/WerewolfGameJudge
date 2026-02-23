/**
 * HostControlButtons - Host 专属控制按钮组（Memoized）
 *
 * 仅负责按 visibility flags 渲染按钮，业务逻辑由 RoomScreen 处理。
 * 渲染 UI 并通过回调上报 onPress，不 import service，不包含业务逻辑判断。
 * 样式由父组件通过 props 注入（actionStyles / dangerStyles），不自建 StyleSheet。
 */
import { Ionicons } from '@expo/vector-icons';
import React, { memo, useMemo } from 'react';

import { TESTIDS } from '@/testids';
import { useColors } from '@/theme';

import { ActionButton } from './ActionButton';
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
  const settingsStyleOverride = useMemo(() => ({ backgroundColor: colors.info }), [colors.info]);

  if (!isHost) return null;

  return (
    <>
      {/* Host: Restart Game - danger style (leftmost) */}
      {showRestart && (
        <ActionButton
          label="重新开始"
          disabled={disabled}
          onPress={(meta) => {
            if (!meta.disabled) onRestartPress();
          }}
          styles={dangerStyles}
        />
      )}

      {/* Host: Settings */}
      {showSettings && (
        <ActionButton
          label="设置"
          icon={<Ionicons name="settings-outline" size={14} color={colors.textInverse} />}
          onPress={() => onSettingsPress()}
          styleOverride={settingsStyleOverride}
          testID={TESTIDS.roomSettingsButton}
          styles={actionStyles}
        />
      )}

      {/* Host: Prepare to Flip */}
      {showPrepareToFlip && (
        <ActionButton
          label="准备看牌"
          disabled={disabled}
          onPress={(meta) => {
            if (!meta.disabled) onPrepareToFlipPress();
          }}
          styles={actionStyles}
        />
      )}

      {/* Host: Start Game */}
      {showStartGame && (
        <ActionButton
          label="开始游戏"
          disabled={disabled}
          onPress={(meta) => {
            if (!meta.disabled) onStartGamePress();
          }}
          styles={actionStyles}
        />
      )}
    </>
  );
};

// Memoize to prevent unnecessary re-renders
export const HostControlButtons = memo(HostControlButtonsComponent);
