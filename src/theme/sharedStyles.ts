/**
 * sharedStyles — Cross-screen reusable style bases
 *
 * Provides token-based style fragments shared across multiple screens.
 * Each consumer spreads the base and overrides only what differs.
 * Does not create StyleSheets — consumers do that in their own factories.
 */
import type { ViewStyle } from 'react-native';

import { borderRadius, type ThemeColors } from './index';
import { componentSizes } from './tokens';

interface SharedStyles {
  /** Square icon button (avatar.md × avatar.md), rounded-medium, bg = background */
  iconButton: ViewStyle;
}

/**
 * Create shared style bases from the current theme colors.
 *
 * Call inside each `createXxxStyles(colors)` factory, then spread:
 * ```ts
 * const shared = createSharedStyles(colors);
 * // ...
 * backButton: { ...shared.iconButton },
 * topBarButton: { ...shared.iconButton, borderRadius: borderRadius.full, overflow: 'hidden' },
 * ```
 */
export function createSharedStyles(colors: ThemeColors): SharedStyles {
  return {
    iconButton: {
      width: componentSizes.avatar.md,
      height: componentSizes.avatar.md,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
  };
}
