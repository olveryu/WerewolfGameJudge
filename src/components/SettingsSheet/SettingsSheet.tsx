/**
 * SettingsSheet — 共享设置面板（动画 + BGM）
 *
 * 底部滑出 Modal，动画区使用 SettingsOptionGroup（图标 + 名称 + 短描述卡片），
 * BGM 区使用 SettingsChipGroup（简洁 chip）。两区共享选中态视觉语言（primary 边框 + 淡紫填充）。
 * 纯 UI 组件：接收当前值和回调，不 import service，不包含业务逻辑。
 * 选项列表由 animationOptions.ts 配置驱动，外部不需要传入。
 * 自带基于 theme tokens 的样式，可在 ConfigScreen 和 RoomScreen 中复用。
 */
import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useMemo } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  type TextStyle,
  TouchableOpacity,
  View,
  type ViewStyle,
} from 'react-native';

import {
  borderRadius,
  componentSizes,
  fixed,
  layout,
  spacing,
  textStyles,
  typography,
  useColors,
  withAlpha,
} from '@/theme';

import { ANIMATION_OPTIONS } from './animationOptions';
import { SettingsChipGroup, type SettingsOption } from './SettingsChipGroup';
import { SettingsOptionGroup } from './SettingsOptionGroup';

// ---------------------------------------------------------------------------
// Constants — BGM 选项列表由组件拥有
// ---------------------------------------------------------------------------

const BGM_OPTIONS: readonly SettingsOption[] = [
  { value: 'on', label: '开' },
  { value: 'off', label: '关' },
] as const;

const BGM_TRACK_OPTIONS: readonly SettingsOption[] = [
  { value: 'random', label: '随机' },
  { value: 'theGodfatherWaltz', label: 'The Godfather Waltz' },
  { value: 'speakSoftlyLove', label: 'Speak Softly Love' },
  { value: 'theImmigrant', label: 'The Immigrant' },
  { value: 'finale', label: 'Finale' },
] as const;

/** Stable style to let ScrollView fill remaining space inside maxHeight parent */
const scrollViewFlex = { flex: 1 } as const;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SettingsSheetProps {
  visible: boolean;
  onClose: () => void;
  roleRevealAnimation: string;
  bgmValue: string;
  bgmTrack: string;
  onAnimationChange: (value: string) => void;
  onBgmChange: (value: string) => void;
  onBgmTrackChange: (value: string) => void;
  /** 当选中"随机"时，实际解析出的动画 value（如 'roulette'），用于显示"本局: X" */
  resolvedAnimation?: string;
  /** testID prefix for animation cards (default: 'settings-animation') */
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
  bgmTrack,
  onAnimationChange,
  onBgmChange,
  onBgmTrackChange,
  resolvedAnimation,
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

  const handleBgmTrackSelect = useCallback(
    (value: string) => {
      onBgmTrackChange(value);
    },
    [onBgmTrackChange],
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
          <View style={styles.header}>
            <Text style={styles.title}>设置</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              hitSlop={{
                top: spacing.small,
                bottom: spacing.small,
                left: spacing.small,
                right: spacing.small,
              }}
              accessibilityRole="button"
              accessibilityLabel="关闭设置"
            >
              <Ionicons name="close" size={componentSizes.icon.md} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView style={scrollViewFlex} showsVerticalScrollIndicator={false} bounces={false}>
            <SettingsOptionGroup
              label="动画"
              options={ANIMATION_OPTIONS}
              selectedValue={roleRevealAnimation}
              onSelect={handleAnimSelect}
              resolvedAnimation={resolvedAnimation}
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

            {bgmValue === 'on' && (
              <SettingsChipGroup
                label="曲目"
                options={BGM_TRACK_OPTIONS}
                selectedValue={bgmTrack}
                onSelect={handleBgmTrackSelect}
                styles={styles.bgmGroup}
                testIDPrefix="settings-bgm-track"
              />
            )}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
});

// ---------------------------------------------------------------------------
// Styles (theme-aware)
// ---------------------------------------------------------------------------

/** Shared chip styles used by BGM group */
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
  header: ViewStyle;
  title: TextStyle;
  closeButton: ViewStyle;
  bgmGroup: ChipGroupStyles;
}

/** Base chip styles for BGM group */
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
      paddingBottom: spacing.xxlarge,
      maxHeight: '85%',
    },
    handle: {
      width: componentSizes.button.sm + spacing.tight,
      height: spacing.tight,
      borderRadius: spacing.micro,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginVertical: spacing.small + spacing.micro,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: spacing.medium,
    },
    title: {
      ...textStyles.subtitleSemibold,
      color: colors.text,
    },
    closeButton: {
      padding: spacing.tight,
    },
    // ── Group cards ──
    groupCard: {
      backgroundColor: colors.background,
      borderRadius: borderRadius.medium,
      padding: spacing.medium,
      marginBottom: spacing.medium,
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
    header: sheetStyles.header,
    title: sheetStyles.title,
    closeButton: sheetStyles.closeButton,
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
