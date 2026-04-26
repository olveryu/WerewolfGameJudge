/**
 * CloseButton — 圆形 ✕ 关闭按钮（共享组件）
 *
 * 两种变体：
 * - `onSurface`：亮色卡片/Modal 上使用（浅灰底 + 灰色图标）
 * - `onOverlay`：深色全屏蒙层上使用（白色半透明底 + 白色图标）
 *
 * 默认 absolute 定位（top-right），消费者可通过 style 覆盖 top/right。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { memo } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

import { UI_ICONS } from '@/config/iconTokens';
import { colors, componentSizes, spacing, typography, withAlpha } from '@/theme';

import { PressableScale } from './PressableScale';

type CloseButtonVariant = 'onSurface' | 'onOverlay';

interface CloseButtonProps {
  onPress: () => void;
  variant?: CloseButtonVariant;
  style?: StyleProp<ViewStyle>;
}

const ICON_SIZE = typography.secondary;

const VARIANT_STYLES: Record<CloseButtonVariant, { bg: string; iconColor: string }> = {
  onSurface: {
    bg: withAlpha(colors.text, 0.1),
    iconColor: colors.textSecondary,
  },
  onOverlay: {
    bg: withAlpha(colors.surface, 0.2),
    iconColor: colors.surface,
  },
};

export const CloseButton = memo<CloseButtonProps>(({ onPress, variant = 'onSurface', style }) => {
  const v = VARIANT_STYLES[variant];
  return (
    <PressableScale
      onPress={onPress}
      style={[styles.button, { backgroundColor: v.bg }, style]}
      accessibilityLabel="关闭"
    >
      <Ionicons name={UI_ICONS.CLOSE} size={ICON_SIZE} color={v.iconColor} />
    </PressableScale>
  );
});

CloseButton.displayName = 'CloseButton';

const styles = StyleSheet.create({
  button: {
    position: 'absolute',
    top: spacing.small,
    right: spacing.small,
    zIndex: 10,
    width: componentSizes.icon.xl,
    height: componentSizes.icon.xl,
    borderRadius: componentSizes.icon.xl / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
