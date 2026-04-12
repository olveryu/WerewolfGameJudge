/**
 * SettingsOptionGroup — 动画选项卡片网格组（label + 2 列 card grid）
 *
 * 声明式组合：分组标签 + 自适应 2 列网格 SettingsOptionCard。
 * 内置分组卡片化样式（background 色 + borderRadius.medium），在 surface 底板上形成轻量层级。
 * 纯 UI 组件：接收选项列表、选中值和回调，不 import service，不包含业务逻辑。
 */
import { memo, useCallback, useMemo } from 'react';
import { StyleSheet, Text, type TextStyle, View, type ViewStyle } from 'react-native';

import {
  borderRadius,
  colors,
  componentSizes,
  fixed,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
  withAlpha,
} from '@/theme';

import type { AnimationOptionConfig } from './animationOptions';
import { getAnimationLabel } from './animationOptions';
import { SettingsOptionCard, type SettingsOptionCardStyles } from './SettingsOptionCard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SettingsOptionGroupProps {
  label: string;
  options: readonly AnimationOptionConfig[];
  selectedValue: string;
  onSelect: (value: string) => void;
  /** 当选中"随机"时，实际解析出的动画 value（如 'roulette'） */
  resolvedAnimation?: string;
  testIDPrefix: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SettingsOptionGroup = memo<SettingsOptionGroupProps>(function SettingsOptionGroup({
  label,
  options,
  selectedValue,
  onSelect,
  resolvedAnimation,
  testIDPrefix,
}) {
  const styles = useMemo(() => createOptionGroupStyles(colors), []);

  const handleSelect = useCallback(
    (value: string) => {
      onSelect(value);
    },
    [onSelect],
  );

  // Build "本局: X" hint for random option
  const resolvedHint = useMemo(() => {
    if (resolvedAnimation == null) return undefined;
    const resolvedLabel = getAnimationLabel(resolvedAnimation);
    return resolvedLabel != null ? `本局: ${resolvedLabel}` : undefined;
  }, [resolvedAnimation]);

  return (
    <View style={styles.groupCard} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={styles.groupLabel}>{label}</Text>
      <View style={styles.cardGrid}>
        {options.map((opt) => (
          <SettingsOptionCard
            key={opt.value}
            option={opt}
            selected={opt.value === selectedValue}
            onSelect={handleSelect}
            styles={styles.card}
            iconColor={colors.textSecondary}
            iconColorSelected={colors.primary}
            iconColorNone={colors.textMuted}
            iconSize={componentSizes.icon.lg}
            resolvedHint={resolvedHint}
            testID={`${testIDPrefix}-option-${opt.value}`}
          />
        ))}
      </View>
    </View>
  );
});

// ---------------------------------------------------------------------------
// Styles (theme-aware)
// ---------------------------------------------------------------------------

interface OptionGroupStyles {
  groupCard: ViewStyle;
  groupLabel: TextStyle;
  cardGrid: ViewStyle;
  card: SettingsOptionCardStyles;
}

function createOptionGroupStyles(colors: ThemeColors): OptionGroupStyles {
  const sheet = StyleSheet.create({
    groupCard: {
      backgroundColor: colors.background,
      borderRadius: borderRadius.medium,
      padding: spacing.medium,
      marginBottom: spacing.medium,
    },
    groupLabel: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.textSecondary,
      fontWeight: typography.weights.medium,
      marginBottom: spacing.small,
    },
    cardGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.small,
    },
    // ── Card base ──
    card: {
      flexBasis: '47%',
      flexGrow: 0,
      maxWidth: '49%',
      alignItems: 'center',
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.small,
      borderRadius: borderRadius.medium,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
      minHeight: componentSizes.button.lg,
    },
    cardSelected: {
      backgroundColor: withAlpha(colors.primary, 0.12),
      borderColor: colors.primary,
      borderWidth: 1.5,
    },
    cardNone: {
      // "关闭"项不额外改背景，仅文字 muted
    },
    iconWrap: {
      marginBottom: spacing.tight,
    },
    label: {
      ...textStyles.secondarySemibold,
      color: colors.text,
      textAlign: 'center',
    },
    labelSelected: {
      color: colors.primary,
    },
    labelNone: {
      color: colors.textMuted,
    },
    desc: {
      fontSize: typography.captionSmall,
      lineHeight: typography.lineHeights.captionSmall,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.micro,
    },
    descSelected: {
      color: colors.primary,
    },
    descNone: {
      color: colors.textMuted,
    },
    resolvedHint: {
      fontSize: typography.captionSmall,
      lineHeight: typography.lineHeights.captionSmall,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.tight,
      fontWeight: typography.weights.medium,
    },
    operationBadge: {
      marginTop: spacing.tight,
      backgroundColor: withAlpha(colors.textMuted, 0.15),
      borderRadius: borderRadius.small,
      paddingHorizontal: spacing.tight,
      paddingVertical: 1,
      alignSelf: 'center',
    },
    operationBadgeText: {
      fontSize: typography.captionSmall,
      lineHeight: typography.lineHeights.captionSmall,
      color: colors.textMuted,
      fontWeight: typography.weights.medium,
    },
  });

  return {
    groupCard: sheet.groupCard,
    groupLabel: sheet.groupLabel,
    cardGrid: sheet.cardGrid,
    card: {
      card: sheet.card,
      cardSelected: sheet.cardSelected,
      cardNone: sheet.cardNone,
      iconWrap: sheet.iconWrap,
      label: sheet.label,
      labelSelected: sheet.labelSelected,
      labelNone: sheet.labelNone,
      desc: sheet.desc,
      descSelected: sheet.descSelected,
      descNone: sheet.descNone,
      resolvedHint: sheet.resolvedHint,
      operationBadge: sheet.operationBadge,
      operationBadgeText: sheet.operationBadgeText,
    },
  };
}
