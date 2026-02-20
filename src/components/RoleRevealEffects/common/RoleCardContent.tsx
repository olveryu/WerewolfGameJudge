/**
 * RoleCardContent - 角色卡片内容区域（无 Modal 包裹）
 *
 * 所有角色卡片 UI 的唯一 source of truth。
 * RoleCardSimple（静态模态框）和各动画效果组件均复用此组件。
 * 长描述自动缩小字号以完整显示在卡片内。
 * 渲染角色卡片内容 UI，通过 children 插槽扩展底部按钮。不 import service，不含业务逻辑。
 */
import type { RoleId } from '@werewolf/game-engine/models/roles';
import { getRoleDisplayAs, getRoleSpec, isWolfRole } from '@werewolf/game-engine/models/roles';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { getFactionName, ROLE_ICONS } from '@/components/roleDisplayUtils';
import { borderRadius, spacing, type ThemeColors, typography, useColors } from '@/theme';

/** White text color for badges/overlays on colored backgrounds */
const BADGE_TEXT_WHITE = '#fff';

// 阵营颜色（从主题 token 取色）
const getFactionColor = (roleId: RoleId, colors: ThemeColors): string => {
  if (isWolfRole(roleId)) return colors.wolf;
  const spec = getRoleSpec(roleId);
  if (spec?.faction === 'god') return colors.god;
  if (spec?.faction === 'special') return colors.third;
  return colors.villager;
};

export interface RoleCardContentProps {
  /** Role ID to display */
  roleId: RoleId;
  /** Card width */
  width?: number;
  /** Card height */
  height?: number;
  /** Additional style */
  style?: ViewStyle;
  /** Test ID */
  testID?: string;
  /** Optional bottom slot (e.g. confirm button) rendered below description */
  children?: React.ReactNode;
  /**
   * 为 true 时跳过 displayAs 映射，显示角色真实身份。
   * 用于裁判视角的技能预览（板子配置 chip）。默认 false（玩家翻牌看伪装身份）。
   */
  showRealIdentity?: boolean;
  /**
   * 双预言家编号（1 或 2），由 seerLabelMap 派生。
   * 存在时角色名显示为 "X号预言家"。仅 seer+mirrorSeer 共存板子使用。
   */
  seerLabel?: number;
}

export const RoleCardContent: React.FC<RoleCardContentProps> = ({
  roleId,
  width = 280,
  height = 392,
  style,
  testID,
  children,
  showRealIdentity = false,
  seerLabel,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors, width, height), [colors, width, height]);

  const spec = getRoleSpec(roleId);

  // mirrorSeer 等有 displayAs 字段的角色：玩家看到的是目标角色的外观
  // showRealIdentity=true 时跳过伪装，用于裁判视角的技能预览
  const displayRoleId = showRealIdentity ? roleId : (getRoleDisplayAs(roleId) ?? roleId);
  const displaySpec = displayRoleId !== roleId ? getRoleSpec(displayRoleId) : spec;
  const baseRoleName = displaySpec?.displayName || roleId;
  const roleName = seerLabel != null ? `${seerLabel}号${baseRoleName}` : baseRoleName;
  const description = displaySpec?.description || '无技能描述';
  const icon = ROLE_ICONS[displayRoleId] || '❓';
  const factionColor = getFactionColor(displayRoleId, colors);
  const factionName = getFactionName(displayRoleId);

  return (
    <View testID={testID} style={[styles.card, { borderColor: factionColor }, style]}>
      <View style={[styles.factionBadge, { backgroundColor: factionColor }]}>
        <Text style={styles.factionText}>{factionName}</Text>
      </View>

      <Text style={styles.roleIcon}>{icon}</Text>
      <Text style={[styles.roleName, { color: factionColor }]}>{roleName}</Text>

      <View style={styles.divider} />

      <Text style={styles.skillTitle}>技能介绍</Text>
      <Text style={styles.description}>{description}</Text>
      {children && <View style={styles.childrenSlot}>{children}</View>}
    </View>
  );
};

/** @internal Exported for RoleCardSimple to access faction color */
export { getFactionColor };

function createStyles(colors: ThemeColors, width: number, height: number) {
  return StyleSheet.create({
    card: {
      width,
      height,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xlarge,
      borderWidth: 3,
      padding: spacing.large,
      alignItems: 'center',
      overflow: 'hidden',
      boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
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
      color: BADGE_TEXT_WHITE,
      fontSize: typography.secondary,
      fontWeight: '600',
    },
    roleIcon: {
      fontSize: 64,
      marginTop: spacing.xlarge + spacing.medium,
      marginBottom: spacing.medium,
    },
    roleName: {
      fontSize: typography.heading,
      fontWeight: '700',
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
      fontSize: typography.body,
      color: colors.text,
      textAlign: 'center',
      lineHeight: typography.body * 1.5,
      paddingHorizontal: spacing.small,
    },
    childrenSlot: {
      marginTop: 'auto',
      alignItems: 'center',
    },
  });
}
