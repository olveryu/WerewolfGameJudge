/**
 * CloseButton — Circular ✕ close button (shared component)
 *
 * Two variants:
 * - `onSurface`: for light cards/Modals (light gray bg + gray icon)
 * - `onOverlay`: for dark full-screen overlays (translucent white bg + white icon)
 *
 * Default absolute positioning (top-right); consumers can override top/right via style.
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
