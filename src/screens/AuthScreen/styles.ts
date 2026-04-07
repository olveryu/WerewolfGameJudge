/**
 * Auth screen styles — LoginOptions / EmailForm / ForgotPassword / ResetPassword modal screens
 *
 * 统一所有 auth modal screen 的视觉样式。基于 createAuthBaseStyles 扩展 modal 容器布局。
 * 仅导出样式工厂函数，不含运行时逻辑。
 */
import { type ViewStyle } from 'react-native';

import { createAuthBaseStyles } from '@/components/auth/authStyles';
import { type AuthStyles } from '@/components/auth/types';
import { borderRadius, spacing, textStyles, type ThemeColors, typography } from '@/theme';

export interface AuthScreenStyles extends AuthStyles {
  modalOverlay: ViewStyle;
  modalContent: ViewStyle;
}

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
