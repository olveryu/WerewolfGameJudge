/**
 * SettingsSheet — 共享设置面板（动画 + BGM）
 *
 * 底部滑出 Modal，动画和 BGM 均使用 chip 平铺选择。
 * 纯 UI 组件：接收当前值和回调，不 import service，不包含业务逻辑。
 * 选项列表由组件内部拥有（ANIMATION_OPTIONS / BGM_OPTIONS），外部不需要传入。
 * 自带基于 theme tokens 的样式，可在 ConfigScreen 和 RoomScreen 中复用。
 */
import { memo, useCallback, useMemo } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

import { borderRadius, layout, spacing, typography, useColors, withAlpha } from '@/theme';
import { componentSizes, fixed } from '@/theme/tokens';

// ---------------------------------------------------------------------------
// Constants — 选项列表由组件拥有，保证单一来源
// ---------------------------------------------------------------------------

interface SettingsOption {
  value: string;
  label: string;
}

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

          {/* Animation chips */}
          <View style={styles.chipGroup}>
            <Text style={styles.chipGroupLabel}>动画</Text>
            <View style={styles.chipWrap}>
              {ANIMATION_OPTIONS.map((opt) => {
                const selected = opt.value === roleRevealAnimation;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => handleAnimSelect(opt.value)}
                    activeOpacity={0.7}
                    testID={`${animationTestIDPrefix}-option-${opt.value}`}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* BGM chips */}
          <View style={styles.chipGroup}>
            <Text style={styles.chipGroupLabel}>BGM</Text>
            <View style={styles.chipWrap}>
              {BGM_OPTIONS.map((opt) => {
                const selected = opt.value === bgmValue;
                return (
                  <TouchableOpacity
                    key={opt.value}
                    style={[styles.chip, selected && styles.chipSelected]}
                    onPress={() => handleBgmSelect(opt.value)}
                    activeOpacity={0.7}
                    testID={`${bgmTestIDPrefix}-option-${opt.value}`}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                      {opt.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
});

// ---------------------------------------------------------------------------
// Styles (theme-aware, mirrors ConfigScreen SettingsSheet styles)
// ---------------------------------------------------------------------------

interface SettingsSheetStyles {
  overlay: ViewStyle;
  content: ViewStyle;
  handle: ViewStyle;
  title: TextStyle;
  chipGroup: ViewStyle;
  chipGroupLabel: TextStyle;
  chipWrap: ViewStyle;
  chip: ViewStyle;
  chipSelected: ViewStyle;
  chipText: TextStyle;
  chipTextSelected: TextStyle;
}

function createStyles(colors: ReturnType<typeof useColors>): SettingsSheetStyles {
  return StyleSheet.create<SettingsSheetStyles>({
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
    chipGroup: {
      marginBottom: spacing.medium,
    },
    chipGroupLabel: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.textSecondary,
      fontWeight: typography.weights.medium,
      marginBottom: spacing.small,
    },
    chipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.small,
    },
    chip: {
      flexBasis: '22%',
      flexGrow: 0,
      maxWidth: '24%',
      alignItems: 'center',
      paddingHorizontal: spacing.small,
      paddingVertical: componentSizes.chip.paddingV,
      borderRadius: borderRadius.full,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    chipSelected: {
      backgroundColor: withAlpha(colors.primary, 0.125),
      borderColor: colors.primary,
    },
    chipText: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.textSecondary,
      fontWeight: typography.weights.medium,
      textAlign: 'center',
    },
    chipTextSelected: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
  });
}
