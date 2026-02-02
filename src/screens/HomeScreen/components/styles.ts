/**
 * HomeScreen shared styles
 *
 * Created once in HomeScreen and passed to all sub-components.
 * This avoids redundant StyleSheet.create calls per component.
 */
import { StyleSheet, type ViewStyle, type TextStyle, type ImageStyle } from 'react-native';
import { type ThemeColors, spacing, borderRadius, typography, shadows } from '../../../theme';

export interface HomeScreenStyles {
  container: ViewStyle;
  scrollView: ViewStyle;
  header: ViewStyle;
  logo: TextStyle;
  title: TextStyle;
  subtitle: TextStyle;
  userBar: ViewStyle;
  userAvatar: TextStyle;
  userAvatarImage: ImageStyle;
  userAvatarPlaceholder: ViewStyle;
  userAvatarIcon: TextStyle;
  userNameText: TextStyle;
  menu: ViewStyle;
  menuItem: ViewStyle;
  menuIcon: ViewStyle;
  menuIconText: TextStyle;
  menuContent: ViewStyle;
  menuTitle: TextStyle;
  menuSubtitle: TextStyle;
  menuArrow: TextStyle;
  divider: ViewStyle;
  modalOverlay: ViewStyle;
  modalContent: ViewStyle;
  modalTitle: TextStyle;
  modalSubtitle: TextStyle;
  codeDisplay: ViewStyle;
  codeDigitBox: ViewStyle;
  codeDigitText: TextStyle;
  modalButtons: ViewStyle;
  primaryButton: ViewStyle;
  primaryButtonText: TextStyle;
  secondaryButton: ViewStyle;
  secondaryButtonText: TextStyle;
  input: TextStyle;
  errorText: TextStyle;
  buttonDisabled: ViewStyle;
  linkButton: ViewStyle;
  linkButtonText: TextStyle;
  outlineButton: ViewStyle;
  outlineButtonText: TextStyle;
  footer: ViewStyle;
  footerText: TextStyle;
}

export function createHomeScreenStyles(colors: ThemeColors): HomeScreenStyles {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    header: {
      alignItems: 'center',
      paddingVertical: spacing.medium,
    },
    logo: {
      fontSize: 64,
      marginBottom: spacing.medium,
    },
    title: {
      fontSize: typography.hero,
      fontWeight: '700',
      color: colors.text,
    },
    subtitle: {
      fontSize: typography.secondary,
      color: colors.textMuted,
      marginTop: spacing.tight,
      letterSpacing: 2,
    },
    userBar: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      marginHorizontal: spacing.medium,
      marginBottom: spacing.medium,
      padding: spacing.medium,
      borderRadius: borderRadius.large,
      ...shadows.md,
    },
    userAvatar: {
      fontSize: 28,
      marginRight: spacing.small,
    },
    userAvatarImage: {
      width: 36,
      height: 36,
      borderRadius: 8,
      marginRight: spacing.small,
      overflow: 'hidden',
    },
    userAvatarPlaceholder: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: spacing.small,
    },
    userAvatarIcon: {
      fontSize: 20,
    },
    userNameText: {
      fontSize: typography.body,
      fontWeight: '600',
      color: colors.textInverse,
      marginLeft: spacing.small,
    },
    menu: {
      backgroundColor: colors.surface,
      marginHorizontal: spacing.medium,
      borderRadius: borderRadius.large,
      ...shadows.md,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.medium,
    },
    menuIcon: {
      width: 44,
      height: 44,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    menuIconText: {
      fontSize: 20,
    },
    menuContent: {
      flex: 1,
      marginLeft: spacing.medium,
    },
    menuTitle: {
      fontSize: typography.body,
      fontWeight: '600',
      color: colors.text,
    },
    menuSubtitle: {
      fontSize: typography.secondary,
      color: colors.textSecondary,
      marginTop: 2,
    },
    menuArrow: {
      fontSize: 24,
      color: colors.textMuted,
    },
    divider: {
      height: 1,
      backgroundColor: colors.borderLight,
      marginHorizontal: spacing.medium,
    },
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
      maxWidth: 340,
    },
    modalTitle: {
      fontSize: typography.title,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    modalSubtitle: {
      fontSize: typography.secondary,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.tight,
      marginBottom: spacing.large,
    },
    codeDisplay: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.small,
      marginBottom: spacing.medium,
    },
    codeDigitBox: {
      width: 56,
      height: 64,
      backgroundColor: colors.background,
      borderRadius: borderRadius.medium,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.border,
    },
    codeDigitText: {
      fontSize: 32,
      fontWeight: '700',
      color: colors.text,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: spacing.small,
    },
    primaryButton: {
      backgroundColor: colors.primary,
      padding: spacing.medium,
      borderRadius: borderRadius.medium,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: colors.textInverse,
      fontSize: typography.body,
      fontWeight: '600',
    },
    secondaryButton: {
      backgroundColor: colors.background,
      padding: spacing.medium,
      borderRadius: borderRadius.medium,
      alignItems: 'center',
    },
    secondaryButtonText: {
      color: colors.textSecondary,
      fontSize: typography.body,
      fontWeight: '500',
    },
    input: {
      backgroundColor: colors.background,
      borderRadius: borderRadius.medium,
      padding: spacing.medium,
      fontSize: typography.body,
      color: colors.text,
      marginBottom: spacing.small,
    },
    errorText: {
      color: colors.error,
      fontSize: typography.secondary,
      textAlign: 'center',
      marginBottom: spacing.small,
    },
    buttonDisabled: {
      opacity: 0.6,
    },
    linkButton: {
      padding: spacing.small,
      alignItems: 'center',
    },
    linkButtonText: {
      color: colors.primary,
      fontSize: typography.secondary,
      fontWeight: '500',
    },
    outlineButton: {
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.medium,
      borderRadius: borderRadius.medium,
      alignItems: 'center',
      marginTop: spacing.small,
    },
    outlineButtonText: {
      color: colors.textSecondary,
      fontSize: typography.body,
      fontWeight: '500',
    },
    footer: {
      alignItems: 'center',
      paddingVertical: spacing.xlarge,
      paddingBottom: spacing.xxlarge,
    },
    footerText: {
      fontSize: typography.caption,
      color: colors.textMuted,
    },
  });
}
