/**
 * SettingsSheet — 共享设置面板（动画 + BGM）
 *
 * 底部滑出 Modal，动画和 BGM 分组卡片化展示，chip 选择使用 PressableScale 弹簧微动效。
 * 纯 UI 组件：接收当前值和回调，不 import service，不包含业务逻辑。
 * 选项列表由组件内部拥有（ANIMATION_OPTIONS / BGM_OPTIONS），外部不需要传入。
 * 自带基于 theme tokens 的样式，可在 ConfigScreen 和 RoomScreen 中复用。
 */
import { memo, useCallback, useMemo } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';

import { borderRadius, layout, spacing, typography, useColors, withAlpha } from '@/theme';
import { componentSizes, fixed } from '@/theme/tokens';

import { SettingsChipGroup, type SettingsOption } from './SettingsChipGroup';

// ---------------------------------------------------------------------------
// Constants — 选项列表由组件拥有，保证单一来源
// ---------------------------------------------------------------------------

export const ANIMATION_OPTIONS: readonly SettingsOption[] = [
  { value: 'random', label: '随机' },
  { value: 'roulette', label: '轮盘' },
  { value: 'roleHunt', label: '猎场' },
  { value: 'scratch', label: '刮卡' },
  { value: 'tarot', label: '塔罗' },
  { value: 'gachaMachine', label: '扭蛋' },
  { value: 'cardPick', label: '抽牌' },
  { value: 'sealBreak', label: '封印' },
  { value: 'chainShatter', label: '锁链' },
  { value: 'fateGears', label: '齿轮' },
  { value: 'none', label: '关闭' },
] as const;

export const BGM_OPTIONS: readonly SettingsOption[] = [
  { value: 'on', label: '开' },
  { value: 'off', label: '关' },
] as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  roleRevealAnimation: string;
  bgmValue: string;
  onAnimationChange: (value: string) => void;
  onBgmChange: (value: string) => void;
  /** testID prefix for animation chips (default: 'settings-animation') */
  animationTestIDPrefix?: string;
  /** testID prefix for BGM chips (default: 'settings-bgm') */
  bgmTestIDPrefix?: string;
  /** testID for the overlay backdrop */
  overlayTestID?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const SettingsSheet = memo(function SettingsSheet({
  visible,
  onClose,
  roleRevealAnimation,
  bgmValue,
  onAnimationChange,
  onBgmChange,
  animationTestIDPrefix = 'settings-animation',
  bgmTestIDPrefix = 'settings-bgm',
  overlayTestID,
}: SettingsSheetProps) {
  const colors = useColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const handleAnimSelect = useCallback(
    (value: string) => {
      onAnimationChange(value);
    },
    [onAnimationChange],
  );

  const handleBgmSelect = useCallback(
    (value: string) => {
      onBgmChange(value);
    },
    [onBgmChange],
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
        testID={overlayTestID}
      >
        <View
          style={styles.content}
          onStartShouldSetResponder={() => true}
          onTouchEnd={(e) => e.stopPropagation()}
        >
          <View style={styles.handle} />
          <Text style={styles.title}>设置</Text>

          <SettingsChipGroup
            label="动画"
            options={ANIMATION_OPTIONS}
            selectedValue={roleRevealAnimation}
            onSelect={handleAnimSelect}
            styles={styles.animGroup}
            testIDPrefix={animationTestIDPrefix}
          />

          <SettingsChipGroup
            label="BGM"
            options={BGM_OPTIONS}
            selectedValue={bgmValue}
            onSelect={handleBgmSelect}
            styles={styles.bgmGroup}
            testIDPrefix={bgmTestIDPrefix}
          />
        </View>
      </TouchableOpacity>
    </Modal>
  );
});

// ---------------------------------------------------------------------------
// Styles (theme-aware)
// ---------------------------------------------------------------------------

/** Shared chip styles used by both animation and BGM groups */
interface ChipGroupStyles {
  groupCard: ViewStyle;
  groupLabel: TextStyle;
  chipWrap: ViewStyle;
  chip: ViewStyle;
  chipSelected: ViewStyle;
  chipText: TextStyle;
  chipTextSelected: TextStyle;
}

interface SettingsSheetStyles {
  overlay: ViewStyle;
  content: ViewStyle;
  handle: ViewStyle;
  title: TextStyle;
  animGroup: ChipGroupStyles;
  bgmGroup: ChipGroupStyles;
}

/** Base chip styles shared between animation and BGM groups */
function createBaseChipStyles(colors: ReturnType<typeof useColors>) {
  return {
    groupLabel: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.textSecondary,
      fontWeight: typography.weights.medium,
      marginBottom: spacing.small,
    } as TextStyle,
    chip: {
      alignItems: 'center',
      paddingHorizontal: spacing.small,
      paddingVertical: componentSizes.chip.paddingV,
      borderRadius: borderRadius.full,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    } as ViewStyle,
    chipSelected: {
      backgroundColor: withAlpha(colors.primary, 0.125),
      borderColor: colors.primary,
    } as ViewStyle,
    chipText: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.textSecondary,
      fontWeight: typography.weights.medium,
      textAlign: 'center',
    } as TextStyle,
    chipTextSelected: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    } as TextStyle,
  };
}

function createStyles(colors: ReturnType<typeof useColors>): SettingsSheetStyles {
  const baseChip = createBaseChipStyles(colors);

  const sheetStyles = StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: colors.overlayLight,
      justifyContent: 'flex-end',
    },
    content: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: borderRadius.large,
      borderTopRightRadius: borderRadius.large,
      paddingHorizontal: layout.screenPaddingH,
      paddingBottom: spacing.xlarge,
    },
    handle: {
      width: componentSizes.button.sm + spacing.tight,
      height: spacing.tight,
      borderRadius: spacing.tight / 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginVertical: spacing.small + spacing.tight / 2,
    },
    title: {
      fontSize: typography.subtitle,
      lineHeight: typography.lineHeights.subtitle,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      marginBottom: spacing.medium,
    },
    // ── Group cards ──
    groupCard: {
      backgroundColor: colors.background,
      borderRadius: borderRadius.medium,
      padding: spacing.medium,
      marginBottom: spacing.medium,
    },
    // ── Animation: 4-column grid ──
    animChipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.small,
    },
    animChip: {
      ...baseChip.chip,
      flexBasis: '22%',
      flexGrow: 0,
      maxWidth: '24%',
    },
    // ── BGM: 2-column grid ──
    bgmChipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.small,
    },
    bgmChip: {
      ...baseChip.chip,
      flexBasis: '47%',
      flexGrow: 0,
      maxWidth: '49%',
    },
  });

  return {
    overlay: sheetStyles.overlay,
    content: sheetStyles.content,
    handle: sheetStyles.handle,
    title: sheetStyles.title,
    animGroup: {
      groupCard: sheetStyles.groupCard,
      groupLabel: baseChip.groupLabel,
      chipWrap: sheetStyles.animChipWrap,
      chip: sheetStyles.animChip,
      chipSelected: baseChip.chipSelected,
      chipText: baseChip.chipText,
      chipTextSelected: baseChip.chipTextSelected,
    },
    bgmGroup: {
      groupCard: sheetStyles.groupCard,
      groupLabel: baseChip.groupLabel,
      chipWrap: sheetStyles.bgmChipWrap,
      chip: sheetStyles.bgmChip,
      chipSelected: baseChip.chipSelected,
      chipText: baseChip.chipText,
      chipTextSelected: baseChip.chipTextSelected,
    },
  };
}
