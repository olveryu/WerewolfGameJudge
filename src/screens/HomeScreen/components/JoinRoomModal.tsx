/**
 * JoinRoomModal - 加入房间弹窗（Memoized）
 *
 * 内嵌 NumPad 输入房间号，通过回调上报加入/取消意图。
 * 渲染 UI 并上报用户 intent，不 import service，不包含业务逻辑判断。
 */
import React, { memo, useMemo } from 'react';
import { Modal, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { NumPad } from '@/components/NumPad';

import { type HomeScreenStyles } from './styles';

interface JoinRoomModalProps {
  visible: boolean;
  roomCode: string;
  isLoading: boolean;
  errorMessage: string | null;
  onRoomCodeChange: (text: string) => void;
  onJoin: () => void;
  onCancel: () => void;
  styles: HomeScreenStyles;
}

const JoinRoomModalComponent: React.FC<JoinRoomModalProps> = ({
  visible,
  roomCode,
  isLoading,
  errorMessage,
  onRoomCodeChange,
  onJoin,
  onCancel,
  styles,
}) => {
  // Memoize digit indices to avoid inline array creation
  const digitIndices = useMemo(() => [0, 1, 2, 3], []);

  return (
    <Modal visible={visible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>加入房间</Text>
          <Text style={styles.modalSubtitle}>输入4位房间号码</Text>

          {/* Room code display */}
          <View style={styles.codeDisplay}>
            {digitIndices.map((i) => (
              <View key={`digit-${i}`} style={styles.codeDigitBox}>
                <Text style={styles.codeDigitText}>{roomCode[i] || ''}</Text>
              </View>
            ))}
          </View>

          {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

          {/* NumPad */}
          <NumPad
            value={roomCode}
            onValueChange={onRoomCodeChange}
            maxLength={4}
            disabled={isLoading}
          />

          <View style={styles.modalButtons}>
            <Button
              variant="secondary"
              onPress={onCancel}
              disabled={isLoading}
              style={styles.modalButtonFlex}
            >
              取消
            </Button>
            <Button
              variant="primary"
              onPress={onJoin}
              loading={isLoading}
              style={styles.modalButtonFlex}
            >
              加入
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export const JoinRoomModal = memo(JoinRoomModalComponent);
