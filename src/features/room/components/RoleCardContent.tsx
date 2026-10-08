/**
 * RoleCardContent - 通用角色卡牌内容（无 Modal 包装）。
 *
 * 游戏无关的卡牌 UI：阵营色主题、角色名、描述、插画区。
 * 各游戏传入 RevealRoleData，组件只负责渲染。
 *
 * 狼人杀复杂逻辑（变体、displayAs 伪装、预言家编号）由调用方在数据层处理，
 * 传入已处理好的 RevealRoleData。
 */
import { LinearGradient } from 'expo-linear-gradient';
import type React from 'react';
import { useMemo } from 'react';
import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import type { RevealAlignment, RevealRoleData } from '@/features/room/model/RevealRoleData';
import { borderRadius, colors, spacing, type ThemeColors, typography } from '@/theme';

/** 阵营色（从 theme tokens） */
function getAlignmentColor(alignment: RevealAlignment, theme: ThemeColors): string {
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
  /** 角色数据（游戏无关） */
  readonly role: RevealRoleData;
  /** 卡牌宽度 */
  readonly width?: number;
  /** 卡牌高度 */
  readonly height?: number;
  /** 额外样式 */
  readonly style?: ViewStyle;
  /** Test ID */
  readonly testID?: string;
  /** 底部插槽（如确认按钮） */
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
  const factionColor = getAlignmentColor(role.alignment, colors);

  return (
    <View style={[styles.card, style]} testID={testID}>
      <LinearGradient
        colors={[factionColor, colors.surface]}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={styles.gradient}
      >
        {/* 阵营徽章 */}
        {role.factionName != null && (
          <View style={[styles.factionBadge, { backgroundColor: factionColor }]}>
            <Text style={styles.factionText}>{role.factionName}</Text>
          </View>
        )}

        {/* 插画区（无图时显示阵营色占位） */}
        <View style={styles.imageContainer}>
          {role.image != null ? (
            <Image source={role.image} style={styles.image} resizeMode="contain" />
          ) : (
            <View style={[styles.placeholder, { backgroundColor: factionColor }]}>
              <Text style={styles.placeholderText}>{role.name.charAt(0)}</Text>
            </View>
          )}
        </View>

        {/* 角色名 */}
        <Text style={styles.roleName}>{role.name}</Text>

        {/* 描述 */}
        {role.description != null && (
          <Text style={styles.description} numberOfLines={6}>
            {role.description}
          </Text>
        )}

        {children}
      </LinearGradient>
    </View>
  );
};

function createStyles(theme: ThemeColors, width: number, height: number) {
  return StyleSheet.create({
    card: {
      width,
      height,
      borderRadius: borderRadius.large,
      overflow: 'hidden',
      backgroundColor: theme.surface,
    },
    gradient: {
      flex: 1,
      padding: spacing.medium,
      alignItems: 'center',
    },
    factionBadge: {
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.tight,
      borderRadius: borderRadius.full,
      marginBottom: spacing.small,
    },
    factionText: {
      color: '#fff',
      fontSize: typography.caption,
      fontWeight: typography.weights.semibold,
    },
    imageContainer: {
      width: width * 0.6,
      height: height * 0.45,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.medium,
    },
    image: {
      width: '100%',
      height: '100%',
    },
    placeholder: {
      width: '100%',
      height: '100%',
      borderRadius: borderRadius.medium,
      justifyContent: 'center',
      alignItems: 'center',
    },
    placeholderText: {
      color: '#fff',
      fontSize: width * 0.2,
      fontWeight: typography.weights.bold,
    },
    roleName: {
      fontSize: typography.title,
      fontWeight: typography.weights.bold,
      color: theme.text,
      marginBottom: spacing.small,
    },
    description: {
      fontSize: typography.secondary,
      color: theme.textSecondary,
      textAlign: 'center',
      lineHeight: typography.lineHeights.secondary,
    },
  });
}
