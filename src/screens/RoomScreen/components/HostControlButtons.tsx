/**
 * HostControlButtons - Host 专属控制按钮组（Memoized）
 *
 * 仅负责按 visibility flags 渲染按钮，业务逻辑由 RoomScreen 处理。
 * 渲染 UI 并通过回调上报 onPress，不 import service，不包含业务逻辑判断。
 */
import React, { memo, useMemo } from 'react';

import { Button } from '@/components/Button';
import { TESTIDS } from '@/testids';
import { useColors } from '@/theme';

interface HostControlButtonsProps {
  // Visibility flags
  isHost: boolean;
  showSettings: boolean;
  showPrepareToFlip: boolean;
  showStartGame: boolean;
  showRestart: boolean;
  /** Disable all action buttons while a host action is in-flight. */
  disabled?: boolean;

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
  onSettingsPress,
  onPrepareToFlipPress,
  onStartGamePress,
  onRestartPress,
}) => {
  const colors = useColors();
  const settingsButtonColor = useMemo(() => colors.info, [colors.info]);

  if (!isHost) return null;

  return (
    <>
      {/* Host: Restart Game - danger style (leftmost) */}
      {showRestart && (
        <Button
          variant="danger"
          disabled={disabled}
          fireWhenDisabled
          testID={TESTIDS.restartButton}
          onPress={(meta: { disabled: boolean }) => {
            if (!meta.disabled) onRestartPress();
          }}
        >
          重新开始
        </Button>
      )}

      {/* Host: Settings */}
      {showSettings && (
        <Button
          variant="primary"
          buttonColor={settingsButtonColor}
          onPress={() => onSettingsPress()}
          testID={TESTIDS.roomSettingsButton}
        >
          房间配置
        </Button>
      )}

      {/* Host: Prepare to Flip */}
      {showPrepareToFlip && (
        <Button
          variant="primary"
          disabled={disabled}
          fireWhenDisabled
          testID={TESTIDS.prepareToFlipButton}
          onPress={(meta: { disabled: boolean }) => {
            if (!meta.disabled) onPrepareToFlipPress();
          }}
        >
          分配角色
        </Button>
      )}

      {/* Host: Start Game */}
      {showStartGame && (
        <Button
          variant="primary"
          disabled={disabled}
          fireWhenDisabled
          testID={TESTIDS.startGameButton}
          onPress={(meta: { disabled: boolean }) => {
            if (!meta.disabled) onStartGamePress();
          }}
        >
          开始游戏
        </Button>
      )}
    </>
  );
};

// Memoize to prevent unnecessary re-renders
export const HostControlButtons = memo(HostControlButtonsComponent);
