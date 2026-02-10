/**
 * RoleCard - 基础角色卡片展示组件
 *
 * 支持正反面显示、对齐主题色。
 *
 * ✅ 允许：渲染卡片 UI
 * ❌ 禁止：import service / 业务逻辑判断
 */
import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import type { RoleAlignment,RoleData } from '@/components/RoleRevealEffects/types';
import { ALIGNMENT_THEMES } from '@/components/RoleRevealEffects/types';
import { borderRadius, shadows,spacing, typography, useColors } from '@/theme';

/** White text color for alignment badge on colored backgrounds */
const BADGE_TEXT_WHITE = '#FFFFFF';

export interface RoleCardProps {
  /** Role data to display */
  role: RoleData;
  /** Card width */
  width?: number;
  /** Card height */
  height?: number;
  /** Show back side (mystery card) */
  showBack?: boolean;
  /** Additional style */
  style?: ViewStyle;
  /** Test ID */
  testID?: string;
}

function getAlignmentLabel(alignment: RoleAlignment): string {
  switch (alignment) {
    case 'wolf':
      return '狼人阵营';
    case 'god':
      return '神职阵营';
    default:
      return '平民阵营';
  }
}

export const RoleCard: React.FC<RoleCardProps> = ({
  role,
  width = 200,
  height = 280,
  showBack = false,
  style,
  testID,
}) => {
  const colors = useColors();
  const theme = ALIGNMENT_THEMES[role.alignment];

  if (showBack) {
    return (
      <View
        testID={testID}
        style={[
          styles.card,
          styles.cardBack,
          {
            width,
            height,
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
          style,
        ]}
      >
        <Text style={[styles.backSymbol, { color: colors.textMuted }]}>?</Text>
        <Text style={[styles.backText, { color: colors.textMuted }]}>身份牌</Text>
      </View>
    );
  }

  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          width,
          height,
          backgroundColor: colors.surface,
          borderColor: theme.primaryColor,
        },
        style,
      ]}
    >
      {/* Avatar/Icon */}
      <View style={[styles.avatarContainer, { backgroundColor: theme.gradientColors[0] }]}>
        <Text style={styles.avatar}>{role.avatar || '❓'}</Text>
      </View>

      {/* Role Name */}
      <Text style={[styles.roleName, { color: theme.primaryColor }]} numberOfLines={1}>
        {role.name}
      </Text>

      {/* Alignment Badge */}
      <View style={[styles.alignmentBadge, { backgroundColor: theme.primaryColor }]}>
        <Text style={styles.alignmentText}>{getAlignmentLabel(role.alignment)}</Text>
      </View>

      {/* Description */}
      {role.description && (
        <Text style={[styles.description, { color: colors.textSecondary }]} numberOfLines={3}>
          {role.description}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: borderRadius.large,
    borderWidth: 2,
    padding: spacing.medium,
    alignItems: 'center',
    justifyContent: 'center',
    // Shadow
    shadowColor: shadows.md.shadowColor,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  cardBack: {
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  backSymbol: {
    fontSize: 64,
    fontWeight: 'bold',
  },
  backText: {
    fontSize: typography.body,
    marginTop: spacing.small,
  },
  avatarContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.medium,
  },
  avatar: {
    fontSize: 48,
  },
  roleName: {
    fontSize: typography.heading,
    fontWeight: 'bold',
    marginBottom: spacing.small,
  },
  alignmentBadge: {
    paddingHorizontal: spacing.medium,
    paddingVertical: spacing.tight,
    borderRadius: borderRadius.small,
    marginBottom: spacing.medium,
  },
  alignmentText: {
    color: BADGE_TEXT_WHITE,
    fontSize: typography.secondary,
    fontWeight: '600',
  },
  description: {
    fontSize: typography.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
