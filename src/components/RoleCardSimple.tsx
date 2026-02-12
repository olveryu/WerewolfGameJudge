/**
 * RoleCardSimple - 无动画直接显示角色卡片模态框
 *
 * 点击"查看身份"后直接显示角色信息，无任何动画。
 *
 * ✅ 允许：渲染角色信息卡片 UI
 * ❌ 禁止：import service / 业务逻辑判断
 */
import React, { useMemo } from 'react';
import { Modal, StyleSheet, Text, TouchableOpacity, useWindowDimensions, View } from 'react-native';

import type { RoleId } from '@/models/roles';
import { getRoleSpec, isWolfRole } from '@/models/roles';
import { borderRadius, shadows, spacing, type ThemeColors, typography, useColors } from '@/theme';

import { getFactionName, ROLE_ICONS } from './roleDisplayUtils';

// 阵营颜色 — 使用 theme token
const getFactionColor = (roleId: RoleId, colors: ThemeColors): string => {
  if (isWolfRole(roleId)) return colors.wolf;
  const spec = getRoleSpec(roleId);
  if (spec?.faction === 'god') return colors.god;
  return colors.textMuted; // 平民
};

export interface RoleCardSimpleProps {
  visible: boolean;
  roleId: RoleId | null;
  onClose: () => void;
}

export const RoleCardSimple: React.FC<RoleCardSimpleProps> = ({ visible, roleId, onClose }) => {
  const colors = useColors();
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = Math.min(screenWidth * 0.75, 280);
  const cardHeight = cardWidth * 1.4;
  const styles = useMemo(
    () => createStyles(colors, cardWidth, cardHeight),
    [colors, cardWidth, cardHeight],
  );

  if (!visible || !roleId) return null;

  const spec = getRoleSpec(roleId);
  const roleName = spec?.displayName || roleId;
  const description = spec?.description || '无技能描述';
  const icon = ROLE_ICONS[roleId] || '❓';
  const factionColor = getFactionColor(roleId, colors);
  const factionName = getFactionName(roleId);

  return (
    <Modal visible={true} transparent animationType="fade" onRequestClose={onClose}>
      <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
        <View style={[styles.card, { borderColor: factionColor }]}>
          <View style={[styles.factionBadge, { backgroundColor: factionColor }]}>
            <Text style={styles.factionText}>{factionName}</Text>
          </View>

          <Text style={styles.roleIcon}>{icon}</Text>
          <Text style={[styles.roleName, { color: factionColor }]}>{roleName}</Text>

          <View style={styles.divider} />

          <Text style={styles.skillTitle}>技能介绍</Text>
          <Text style={styles.description}>{description}</Text>

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

function createStyles(colors: ThemeColors, cardWidth: number, cardHeight: number) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    card: {
      width: cardWidth,
      height: cardHeight,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xlarge,
      borderWidth: 3,
      padding: spacing.large,
      alignItems: 'center',
      ...shadows.lg,
    },
    factionBadge: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      paddingVertical: spacing.tight,
      borderTopLeftRadius: borderRadius.xlarge - 3,
      borderTopRightRadius: borderRadius.xlarge - 3,
      alignItems: 'center',
    },
    factionText: {
      color: colors.textInverse,
      fontSize: typography.secondary,
      fontWeight: typography.weights.semibold,
    },
    roleIcon: {
      fontSize: 64,
      marginTop: spacing.xlarge + spacing.medium,
      marginBottom: spacing.medium,
    },
    roleName: {
      fontSize: typography.heading,
      fontWeight: typography.weights.bold,
    },
    divider: {
      width: '80%',
      height: 1,
      backgroundColor: colors.border,
      marginVertical: spacing.medium,
    },
    skillTitle: {
      fontSize: typography.secondary,
      color: colors.textSecondary,
      marginBottom: spacing.tight,
    },
    description: {
      fontSize: typography.secondary,
      color: colors.text,
      textAlign: 'center',
      lineHeight: typography.secondary * 1.5,
      paddingHorizontal: spacing.small,
      flex: 1,
    },
    confirmButton: {
      paddingHorizontal: spacing.xlarge,
      paddingVertical: spacing.medium,
      borderRadius: borderRadius.full,
      marginTop: spacing.medium,
    },
    confirmButtonText: {
      color: colors.textInverse,
      fontSize: typography.body,
      fontWeight: typography.weights.semibold,
    },
  });
}
