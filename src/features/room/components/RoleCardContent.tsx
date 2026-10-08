/**
 * RoleCardContent - 游戏无关的角色卡内容区（无 Modal 包装）。
 *
 * 从狼人杀 RoleCardContent 逐行移植（静态模式），仅替换数据源：
 * - roleId: RoleId → role: RevealRoleData（调用方预处理 displayAs/seerLabel）
 * - getRoleSpec/getRoleAvatar/getFactionName → role 对象的字段
 * - getFactionColor(roleId) → getRevealFactionColor(alignment)
 * - RoleDescriptionView → StructuredDescriptionView
 *
 * 视觉与原版逐像素一致：surface 纯色背景 + 阵营色边框 + 阴影 + 顶部阵营徽章
 * + 38% 宽立绘 + 阵营色角色名 + 分隔线 + 结构化描述 + 底部插槽。
 * 无立绘时显示阵营色占位（角色名首字）。
 *
 * 动画模式（revealMode/animateEntrance）在 Phase B 泛化 RoleRevealAnimator 时处理。
 */
import type React from 'react';
import { useMemo } from 'react';
import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import { borderRadius, colors, fixed, spacing, type ThemeColors, typography } from '@/theme';

import type { RevealAlignment, RevealRoleData } from '../model/RevealRoleData';
import { StructuredDescriptionView } from './StructuredDescriptionView';

/** White text color for badges/overlays on colored backgrounds */
const BADGE_TEXT_WHITE = '#fff';

/**
 * 阵营色（从 theme tokens）。
 * 对应原版 getFactionColor：wolf→红，god→蓝，third→特殊色，villager→绿。
 */
export function getRevealFactionColor(alignment: RevealAlignment, theme: ThemeColors): string {
  switch (alignment) {
    case 'wolf':
      return theme.wolf;
    case 'god':
      return theme.god;
    case 'third':
      return theme.third;
    case 'villager':
      return theme.villager;
  }
}

interface RoleCardContentProps {
  /** 游戏无关的角色数据（调用方已处理 displayAs/seerLabel） */
  readonly role: RevealRoleData;
  /** Card width */
  readonly width?: number;
  /** Card height */
  readonly height?: number;
  /** Additional style */
  readonly style?: ViewStyle;
  /** Test ID */
  readonly testID?: string;
  /** Optional bottom slot (e.g. confirm button) rendered below description */
  readonly children?: React.ReactNode;
}

export const RoleCardContent: React.FC<RoleCardContentProps> = ({
  role,
  width = 280,
  height = 392,
  style,
  testID,
  children,
}) => {
  const styles = useMemo(() => createStyles(colors, width, height), [width, height]);

  const factionColor = getRevealFactionColor(role.alignment, colors);
  const factionName = role.factionName ?? '';
  const descriptionFields = Array.isArray(role.description) ? role.description : undefined;
  const descriptionFallback =
    typeof role.description === 'string' ? role.description : '无技能描述';

  return (
    <View testID={testID} style={[styles.card, { borderColor: factionColor }, style]}>
      {/* Faction badge — top, full width */}
      {factionName.length > 0 && (
        <View style={[styles.factionBadge, { backgroundColor: factionColor }]}>
          <Text style={styles.factionText}>{factionName}</Text>
        </View>
      )}

      {role.image != null ? (
        <Image
          source={role.image}
          resizeMode="contain"
          style={styles.roleIconImage}
          testID="role-badge"
        />
      ) : (
        /* 无立绘占位：阵营色圆角方块 + 角色名首字 */
        <View
          style={[
            styles.roleIconImage,
            styles.roleIconPlaceholder,
            { backgroundColor: factionColor },
          ]}
          testID="role-badge"
        >
          <Text style={styles.roleIconPlaceholderText}>{role.name.charAt(0)}</Text>
        </View>
      )}

      <Text style={[styles.roleName, { color: factionColor }]}>{role.name}</Text>

      <View style={styles.divider} />
      <StructuredDescriptionView
        fields={descriptionFields}
        descriptionFallback={descriptionFallback}
        factionColor={factionColor}
      />
      {children != null && <View style={styles.childrenSlot}>{children}</View>}
    </View>
  );
};

function createStyles(colors: ThemeColors, width: number, height: number) {
  const iconSize = Math.round(width * 0.38);
  return StyleSheet.create({
    card: {
      width,
      height,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xlarge,
      borderWidth: fixed.borderWidthHighlight,
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
      borderTopLeftRadius: borderRadius.xlarge - fixed.borderWidthHighlight,
      borderTopRightRadius: borderRadius.xlarge - fixed.borderWidthHighlight,
      alignItems: 'center',
    },
    factionText: {
      color: BADGE_TEXT_WHITE,
      fontSize: typography.secondary,
      fontWeight: '600',
    },
    roleIconImage: {
      width: iconSize,
      height: iconSize,
      marginTop: spacing.xlarge,
      marginBottom: spacing.small,
    },
    roleIconPlaceholder: {
      borderRadius: borderRadius.large,
      alignItems: 'center',
      justifyContent: 'center',
    },
    roleIconPlaceholderText: {
      color: BADGE_TEXT_WHITE,
      fontSize: Math.round(iconSize * 0.4),
      fontWeight: '700',
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
    childrenSlot: {
      marginTop: 'auto',
      alignItems: 'center',
    },
  });
}
