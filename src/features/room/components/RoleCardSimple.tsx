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

import { getRevealFactionColor, RoleCardContent } from './RoleCardContent';

interface RoleCardSimpleProps {
  readonly visible: boolean;
  /** 角色数据（null 时不渲染） */
  readonly role: RevealRoleData | null;
  readonly onClose: () => void;
  /** 确认按钮文案，缺省"我知道了" */
  readonly confirmText?: string;
  /** 底部额外内容（如变体切换、AI 按钮，由游戏传入） */
  readonly footer?: React.ReactNode;
  /** 卡片 testID，缺省 'role-card-modal'；游戏可传自己的定位 ID。 */
  readonly testID?: string;
  /** 角色名文本 testID（可选）。 */
  readonly nameTestID?: string;
  /** 单字段描述模式的章节标题（可选），缺省 '技能介绍'。 */
  readonly descriptionTitle?: string;
  /** 确认按钮 testID（可选）。 */
  readonly confirmTestID?: string;
}

export const RoleCardSimple: React.FC<RoleCardSimpleProps> = ({
  visible,
  role,
  onClose,
  confirmText = '知道了',
  footer,
  testID = 'role-card-modal',
  nameTestID,
  descriptionTitle,
  confirmTestID,
}) => {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.min(screenWidth * 0.82, 360);
  const cardHeight = cardWidth * 1.5;

  if (!visible || role === null) return null;

  const factionColor = getRevealFactionColor(role.alignment, colors);

  return (
    <Modal visible={true} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={styles.cardWrapper}>
          <RoleCardContent
            testID={testID}
            nameTestID={nameTestID}
            descriptionTitle={descriptionTitle}
            role={role}
            width={cardWidth}
            height={cardHeight}
          />
          {footer}
          <View style={styles.confirmButton}>
            <Button
              variant="primary"
              buttonColor={factionColor}
              onPress={onClose}
              testID={confirmTestID}
            >
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
