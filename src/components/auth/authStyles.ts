/**
 * Auth shared base styles — HomeScreen 和 SettingsScreen 的 AuthStyles 公共基础
 *
 * 提取完全重复的样式 key；各 screen 需通过 spread override 差异化的 key。
 * 仅导出样式工厂函数，不含运行时逻辑。
 */
import { Platform, type TextStyle, type ViewStyle } from 'react-native';

import {
  borderRadius,
  componentSizes,
  fixed,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
} from '@/theme';

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
      ...textStyles.subtitleSemibold,
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
      alignItems: 'stretch',
      height: spacing.xxlarge,
      backgroundColor: colors.background,
      borderRadius: borderRadius.medium,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      paddingHorizontal: spacing.medium,
      marginBottom: spacing.medium,
    },
    passwordWrapperFocused: {
      borderColor: colors.primary,
      borderWidth: 2,
    } as ViewStyle,
    passwordInputContainer: {
      flex: 1,
    } as ViewStyle,
    passwordInput: {
      flex: 1,
      marginBottom: 0,
      paddingHorizontal: 0,
      borderWidth: 0,
      backgroundColor: 'transparent',
      // Web-only: suppress browser focus ring (wrapper provides visual boundary)
      ...Platform.select({ web: { outlineStyle: 'none' } }),
    } as TextStyle,
    eyeButton: {
      alignSelf: 'center',
      justifyContent: 'center',
      alignItems: 'center',
      paddingLeft: spacing.small,
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
      padding: spacing.medium,
      borderRadius: borderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.medium,
    },
    primaryButtonText: {
      ...textStyles.bodySemibold,
      color: colors.textInverse,
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
      ...textStyles.bodyMedium,
      color: colors.textSecondary,
    },
    buttonDisabled: {
      opacity: fixed.disabledOpacity,
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
    buttonCaptionInverseMuted: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.textInverse,
      textAlign: 'center',
      marginTop: spacing.tight,
      opacity: 0.55,
    },
    // Avatar preview card (LoginOptions)
    avatarStripContainer: {
      backgroundColor: colors.surface,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      borderRadius: borderRadius.large,
      alignItems: 'center',
      paddingVertical: spacing.medium,
      paddingHorizontal: spacing.medium,
      marginBottom: spacing.medium,
    },
    avatarStripRow: {
      flexDirection: 'row',
      gap: spacing.small,
      marginBottom: spacing.small,
    },
    avatarStripImage: {
      width: componentSizes.avatar.md,
      height: componentSizes.avatar.md,
      borderRadius: borderRadius.medium,
    },
    avatarStripText: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.textSecondary,
    },
  };
}
