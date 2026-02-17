/**
 * JoinRoomModal - 加入房间弹窗（Memoized）
 *
 * 内嵌 NumPad 输入房间号，通过回调上报加入/取消意图。
 *
 * ✅ 允许：渲染 UI + 上报用户 intent
 * ❌ 禁止：import service / 业务逻辑判断
 */
import React, { memo, useMemo } from 'react';
import { Modal, Text, TouchableOpacity, View } from 'react-native';

import { NumPad } from '@/components/NumPad';

import { type HomeScreenStyles } from './styles';

export interface JoinRoomModalProps {
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
              <View key={i} style={styles.codeDigitBox}>
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
            <TouchableOpacity
              style={[
                styles.secondaryButton,
                styles.modalButtonFlex,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={onCancel}
              activeOpacity={isLoading ? 1 : 0.7}
              accessibilityState={{ disabled: isLoading }}
            >
              <Text style={styles.secondaryButtonText}>取消</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.primaryButton,
                styles.modalButtonFlex,
                isLoading && styles.buttonDisabled,
              ]}
              onPress={onJoin}
              activeOpacity={isLoading ? 1 : 0.7}
              accessibilityState={{ disabled: isLoading }}
            >
              <Text style={styles.primaryButtonText}>{isLoading ? '加入中...' : '加入'}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export const JoinRoomModal = memo(JoinRoomModalComponent);
