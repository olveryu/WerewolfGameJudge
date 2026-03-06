/**
 * Auth shared base styles — HomeScreen 和 SettingsScreen 的 AuthStyles 公共基础
 *
 * 提取完全重复的样式 key；各 screen 需通过 spread override 差异化的 key。
 * 仅导出样式工厂函数，不含运行时逻辑。
 */
import { type TextStyle, type ViewStyle } from 'react-native';

import { borderRadius, spacing, type ThemeColors, typography } from '@/theme';
import { fixed } from '@/theme/tokens';

import { type AuthStyles } from './types';

/**
 * Create base auth styles shared between HomeScreen and SettingsScreen.
 *
 * Returns all keys defined in AuthStyles. Each consumer can spread and override
 * context-specific keys (e.g. `formTitle`, `primaryButton`).
 */
export function createAuthBaseStyles(colors: ThemeColors): AuthStyles {
  return {
    // Layout
    formContainer: {} as ViewStyle,
    formTitle: {
      fontSize: typography.subtitle,
      lineHeight: typography.lineHeights.subtitle,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      textAlign: 'center',
    },
    formSubtitle: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.tight,
      marginBottom: spacing.large,
    },
    // Input
    input: {
      height: spacing.xxlarge,
      backgroundColor: colors.background,
      borderRadius: borderRadius.medium,
      paddingHorizontal: spacing.medium,
      fontSize: typography.body,
      lineHeight: typography.lineHeights.body,
      color: colors.text,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      marginBottom: spacing.medium,
    } as TextStyle,
    passwordWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: borderRadius.medium,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      marginBottom: spacing.medium,
    },
    passwordInput: {
      marginBottom: 0,
      flex: 1,
    } as TextStyle,
    eyeButton: {
      paddingHorizontal: spacing.small,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // Email domain dropdown
    emailDomainDropdown: {
      marginTop: -spacing.tight,
      marginBottom: spacing.small,
      backgroundColor: colors.surface,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      borderRadius: borderRadius.medium,
      overflow: 'hidden',
    },
    emailDomainItem: {
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.borderLight,
    },
    emailDomainText: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.text,
    },
    // Error
    errorText: {
      color: colors.error,
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      textAlign: 'center',
      marginBottom: spacing.small,
    },
    // Buttons
    primaryButton: {
      backgroundColor: colors.primary,
      height: spacing.xxlarge,
      borderRadius: borderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.medium,
    },
    primaryButtonText: {
      color: colors.textInverse,
      fontSize: typography.body,
      lineHeight: typography.lineHeights.body,
      fontWeight: typography.weights.semibold,
    },
    secondaryButton: {
      alignItems: 'center',
      paddingVertical: spacing.small,
    },
    secondaryButtonText: {
      color: colors.textSecondary,
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
    },
    linkButton: {
      alignItems: 'center',
      paddingVertical: spacing.small,
    },
    linkButtonText: {
      color: colors.primary,
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
    },
    outlineButton: {
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      borderRadius: borderRadius.full,
      alignItems: 'center',
      marginBottom: spacing.medium,
    },
    outlineButtonText: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: typography.lineHeights.body,
      fontWeight: typography.weights.medium,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    buttonCaption: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.tight,
    },
    buttonCaptionInverse: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.textInverse,
      textAlign: 'center',
      marginTop: spacing.tight,
      opacity: 0.8,
    },
  };
}
