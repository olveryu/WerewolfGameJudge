/**
 * RoleCardContent - Role card display matching RoleCardSimple style
 *
 * This is the content portion of RoleCardSimple without Modal wrapper.
 * Used by animation effects (flip, fog, scratch, fragment) to show
 * the same card style that RoleCardSimple displays.
 */
import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Platform, ViewStyle } from 'react-native';
import { useColors, spacing, typography, borderRadius, type ThemeColors } from '../../../theme';
import type { RoleId } from '../../../models/roles';
import { getRoleSpec, isWolfRole } from '../../../models/roles';

// 角色对应的 emoji 图标
const ROLE_ICONS: Record<string, string> = {
  // 狼人阵营
  wolf: '🐺',
  wolfKing: '👑🐺',
  darkWolfKing: '🌑👑',
  whiteWolfKing: '⚪👑',
  wolfQueen: '👸🐺',
  nightmare: '😱',
  gargoyle: '🗿',
  wolfRobot: '🤖🐺',
  // 神职阵营
  seer: '🔮',
  witch: '🧙‍♀️',
  hunter: '🏹',
  guard: '🛡️',
  psychic: '👁️',
  dreamcatcher: '🌙',
  magician: '🎩',
  spiritKnight: '⚔️',
  // 平民
  villager: '👤',
  slacker: '😴',
};

// 阵营颜色
const getFactionColor = (roleId: RoleId): string => {
  if (isWolfRole(roleId)) return '#DC2626'; // 红色 - 狼人
  const spec = getRoleSpec(roleId);
  if (spec?.faction === 'god') return '#3B82F6'; // 蓝色 - 神职
  return '#6B7280'; // 灰色 - 平民
};

const getFactionName = (roleId: RoleId): string => {
  if (isWolfRole(roleId)) return '狼人阵营';
  const spec = getRoleSpec(roleId);
  if (spec?.faction === 'god') return '神职阵营';
  return '平民阵营';
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
}

export const RoleCardContent: React.FC<RoleCardContentProps> = ({
  roleId,
  width = 280,
  height = 392,
  style,
  testID,
}) => {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors, width, height), [colors, width, height]);

  const spec = getRoleSpec(roleId);
  const roleName = spec?.displayName || roleId;
  const description = spec?.description || '无技能描述';
  const icon = ROLE_ICONS[roleId] || '❓';
  const factionColor = getFactionColor(roleId);
  const factionName = getFactionName(roleId);

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
    </View>
  );
};

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
      ...Platform.select({
        ios: {
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.5,
          shadowRadius: 20,
        },
        android: {
          elevation: 20,
        },
        web: {
          boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
        },
      }),
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
      color: '#fff',
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
      fontSize: typography.secondary,
      color: colors.text,
      textAlign: 'center',
      lineHeight: typography.secondary * 1.5,
      paddingHorizontal: spacing.small,
    },
  });
}

export default RoleCardContent;
