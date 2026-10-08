/**
 * RoleCardContent - 通用角色卡牌内容（无 Modal 包装）。
 *
 * 游戏无关的卡牌 UI，视觉与狼人杀原版逐像素一致：
 * - 卡片：surface 底色 + 阵营色边框 + 阴影
 * - 顶部阵营徽章（绝对定位）
 * - 角色立绘（38% 宽度）
 * - 角色名（阵营色，heading 字号）
 * - 分隔线 + 结构化描述
 *
 * 各游戏传入 RevealRoleData，组件只负责渲染。
 */
import type React from 'react';
import { useMemo } from 'react';
import { Image, StyleSheet, Text, View, type ViewStyle } from 'react-native';

import type {
  DescriptionField,
  RevealAlignment,
  RevealRoleData,
} from '@/features/room/model/RevealRoleData';
import {
  borderRadius,
  colors,
  fixed,
  spacing,
  type ThemeColors,
  typography,
} from '@/theme';

/** 白色文字（徽章/覆盖层用） */
const BADGE_TEXT_WHITE = '#fff';

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
  /** 底部插槽 */
  readonly children?: React.ReactNode;
}

/**
 * 通用描述视图：支持结构化字段或简单字符串。
 * 结构化时显示标签 + 内容；简单时居中显示文本。
 */
function DescriptionView({
  description,
  factionColor,
}: {
  readonly description: readonly DescriptionField[] | string | undefined;
  readonly factionColor: string;
}) {
  if (description == null) {
    return <Text style={descStyles.empty}>无技能描述</Text>;
  }
  if (typeof description === 'string') {
    return <Text style={descStyles.simple}>{description}</Text>;
  }
  if (description.length === 0) {
    return <Text style={descStyles.empty}>无技能描述</Text>;
  }
  // 单字段居中（阿瓦隆模式）
  const firstField = description[0];
  if (description.length === 1 && firstField !== undefined) {
    return <Text style={descStyles.simple}>{firstField.content}</Text>;
  }
  // 多字段带标签（狼人杀模式）
  return (
    <View style={descStyles.container}>
      {description.map((field, index) => (
        <View key={index} style={descStyles.field}>
          <View style={[descStyles.accentBar, { backgroundColor: factionColor }]} />
          <View style={descStyles.fieldContent}>
            <Text style={descStyles.label}>{field.label}</Text>
            <Text style={descStyles.content}>{field.content}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const descStyles = StyleSheet.create({
  container: {
    width: '100%',
  },
  field: {
    flexDirection: 'row',
    marginBottom: spacing.small,
  },
  accentBar: {
    width: 2,
    borderRadius: 1,
    marginRight: spacing.small,
    opacity: 0.3,
  },
  fieldContent: {
    flex: 1,
  },
  label: {
    fontSize: typography.caption,
    fontWeight: typography.weights.semibold,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  content: {
    fontSize: typography.secondary,
    color: colors.text,
    lineHeight: typography.lineHeights.secondary,
  },
  simple: {
    fontSize: typography.secondary,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.lineHeights.secondary,
  },
  empty: {
    fontSize: typography.secondary,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

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
    <View testID={testID} style={[styles.card, { borderColor: factionColor }, style]}>
      {/* 阵营徽章 */}
      {role.factionName != null && (
        <View style={[styles.factionBadge, { backgroundColor: factionColor }]}>
          <Text style={styles.factionText}>{role.factionName}</Text>
        </View>
      )}

      {/* 角色立绘 */}
      {role.image != null ? (
        <Image
          source={role.image}
          resizeMode="contain"
          style={styles.roleIconImage}
          testID="role-badge"
        />
      ) : (
        <View style={[styles.placeholder, { backgroundColor: factionColor }]}>
          <Text style={styles.placeholderText}>{role.name.charAt(0)}</Text>
        </View>
      )}

      {/* 角色名（阵营色） */}
      <Text style={[styles.roleName, { color: factionColor }]}>{role.name}</Text>

      {/* 分隔线 + 描述 */}
      <View style={styles.divider} />
      <DescriptionView description={role.description} factionColor={factionColor} />

      {children != null && <View style={styles.childrenSlot}>{children}</View>}
    </View>
  );
};

function createStyles(theme: ThemeColors, width: number, height: number) {
  return StyleSheet.create({
    card: {
      width,
      height,
      backgroundColor: theme.surface,
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
      width: Math.round(width * 0.38),
      height: Math.round(width * 0.38),
      marginTop: spacing.xlarge,
      marginBottom: spacing.small,
    },
    placeholder: {
      width: Math.round(width * 0.38),
      height: Math.round(width * 0.38),
      marginTop: spacing.xlarge,
      marginBottom: spacing.small,
      borderRadius: borderRadius.medium,
      justifyContent: 'center',
      alignItems: 'center',
    },
    placeholderText: {
      color: BADGE_TEXT_WHITE,
      fontSize: Math.round(width * 0.15),
      fontWeight: typography.weights.bold,
    },
    roleName: {
      fontSize: typography.heading,
      fontWeight: '700',
    },
    divider: {
      width: '80%',
      height: 1,
      backgroundColor: theme.border,
      marginVertical: spacing.medium,
    },
    childrenSlot: {
      marginTop: 'auto',
      alignItems: 'center',
    },
  });
}
