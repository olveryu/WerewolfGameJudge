/**
 * RoleCardSimple - 通用角色卡弹窗（无动画，直接展示）。
 *
 * 游戏无关：传入 RevealRoleData，渲染同款卡牌。
 * 狼人杀：通过适配器传入（含变体/AI 逻辑在适配器层）
 * 阿瓦隆：直接传入角色数据
 */
import type React from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Modal } from '@/components/AppModal';
import { Button } from '@/components/Button';
import type { RevealRoleData } from '@/features/room/model/RevealRoleData';
import { colors, spacing } from '@/theme';

import { RoleCardContent } from './RoleCardContent';

interface RoleCardSimpleProps {
  readonly visible: boolean;
  /** 角色数据（null 时不渲染） */
  readonly role: RevealRoleData | null;
  readonly onClose: () => void;
  /** 确认按钮文案，缺省"我知道了" */
  readonly confirmText?: string;
  /** 底部额外内容（如变体切换、AI 按钮，由游戏传入） */
  readonly footer?: React.ReactNode;
}

export const RoleCardSimple: React.FC<RoleCardSimpleProps> = ({
  visible,
  role,
  onClose,
  confirmText = '知道了',
  footer,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.min(screenWidth * 0.82, 360);
  const cardHeight = cardWidth * 1.5;

  if (!visible || role === null) return null;

  return (
    <Modal visible={true} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.cardWrapper}>
          <RoleCardContent
            testID="role-card-modal"
            role={role}
            width={cardWidth}
            height={cardHeight}
          />
          {footer}
          <View style={styles.confirmButton}>
            <Button variant="primary" onPress={onClose}>
              {confirmText}
            </Button>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardWrapper: {
    alignItems: 'center',
    position: 'relative',
    zIndex: 1,
  },
  confirmButton: {
    marginTop: spacing.medium,
    width: '100%',
  },
});
