/**
 * RoleCardSimple - 无动画直接显示角色卡片模态框
 *
 * 点击"查看身份"后直接显示角色信息，无任何动画。
 * 卡片内容复用 RoleCardContent，本组件仅负责 Modal 包裹 + "我知道了"按钮。
 *
 * ✅ 允许：渲染 Modal + 按钮
 * ❌ 禁止：import service / 业务逻辑判断 / 重复卡片 UI
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import React, { useMemo } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import {
  getFactionColor,
  RoleCardContent,
} from '@/components/RoleRevealEffects/common/RoleCardContent';
import { borderRadius, spacing, type ThemeColors, typography, useColors } from '@/theme';

interface RoleCardSimpleProps {
  visible: boolean;
  roleId: RoleId | null;
  onClose: () => void;
}

export const RoleCardSimple: React.FC<RoleCardSimpleProps> = ({ visible, roleId, onClose }) => {
  const colors = useColors();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.min(screenWidth * 0.82, 320);
  const cardHeight = cardWidth * 1.5;
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (!visible || !roleId) return null;

  const factionColor = getFactionColor(roleId);

  return (
    <Modal visible={true} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={styles.cardWrapper}>
          <RoleCardContent
            testID="role-card-modal"
            roleId={roleId}
            width={cardWidth}
            height={cardHeight}
          />
          <TouchableOpacity
            style={[styles.confirmButton, { backgroundColor: factionColor }]}
            onPress={onClose}
          >
            <Text style={styles.confirmButtonText}>我知道了</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

function createStyles(colors: ThemeColors) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    cardWrapper: {
      alignItems: 'center',
    },
    confirmButton: {
      paddingHorizontal: spacing.xlarge,
      paddingVertical: spacing.medium,
      borderRadius: borderRadius.full,
      marginTop: -spacing.large,
    },
    confirmButtonText: {
      color: colors.textInverse,
      fontSize: typography.body,
      fontWeight: typography.weights.semibold,
    },
  });
}
