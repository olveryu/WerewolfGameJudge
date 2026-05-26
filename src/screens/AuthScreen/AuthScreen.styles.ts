/**
 * Auth screen styles — LoginOptions / EmailForm / ForgotPassword / ResetPassword modal screens
 *
 * Unified visual styling for all auth modal screens. Extends createAuthBaseStyles with modal container layout.
 * Exports only style factory functions; contains no runtime logic.
 */
import { type ViewStyle } from 'react-native';

import { createAuthBaseStyles } from '@/components/auth/authStyles';
import { type AuthStyles } from '@/components/auth/types';
import { borderRadius, shadows, spacing, textStyles, type ThemeColors, typography } from '@/theme';

interface AuthScreenStyles extends AuthStyles {
  modalOverlay: ViewStyle;
  modalContent: ViewStyle;
}

/** Create auth screen styles. */
export function createAuthScreenStyles(colors: ThemeColors, screenWidth: number): AuthScreenStyles {
  const base = createAuthBaseStyles(colors);
  return {
    ...base,
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      padding: spacing.large,
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.xlarge,
      padding: spacing.large,
      width: '100%',
      maxWidth: Math.min(400, screenWidth * 0.85),
      ...shadows.lg,
    },
    // Override formTitle to be larger for modal context
    formTitle: {
      ...base.formTitle,
      ...textStyles.titleBold,
    },
    secondaryButton: {
      padding: spacing.medium,
      borderRadius: borderRadius.full,
      alignItems: 'center',
    },
    linkButtonText: {
      color: colors.primary,
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      fontWeight: typography.weights.medium,
    },
  };
}
