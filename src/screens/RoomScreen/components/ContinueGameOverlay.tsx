/**
 * ContinueGameOverlay - Full-screen overlay shown after Host rejoin during ongoing game
 *
 * 职责：
 * - 用户手势解锁浏览器 AudioContext（Web autoplay policy 要求）
 * - 触发 BGM 恢复 + 当前步骤音频重播（如果断开时正在播放）
 *
 * 显示条件：isHost + ongoing + needsContinueOverlay（由 useRoomScreenState 管理）。
 * Only imports types, styles, and UI components. Does not import Service singletons or showAlert.
 */
import React, { memo } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

import { TESTIDS } from '@/testids';

import { type ContinueGameOverlayStyles } from './styles';

interface ContinueGameOverlayProps {
  /** Whether the overlay is visible */
  visible: boolean;
  /** Called when user taps "继续游戏" — must be in user gesture context for audio unlock */
  onContinue: () => void;
  /** Pre-created styles from parent */
  styles: ContinueGameOverlayStyles;
}

const ContinueGameOverlayComponent: React.FC<ContinueGameOverlayProps> = ({
  visible,
  onContinue,
  styles,
}) => {
  return (
    <Modal visible={visible} transparent={true} animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.content}>
          <Text style={styles.title}>游戏已恢复</Text>
          <Text style={styles.message}>点击下方按钮继续游戏并恢复音频</Text>
          <TouchableOpacity
            style={styles.button}
            onPress={onContinue}
            testID={TESTIDS.continueGameButton}
            activeOpacity={0.8}
          >
            <Text style={styles.buttonText}>🔊 继续游戏</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

export const ContinueGameOverlay = memo(ContinueGameOverlayComponent);

ContinueGameOverlay.displayName = 'ContinueGameOverlay';
