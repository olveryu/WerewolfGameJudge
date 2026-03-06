/**
 * HomeScreen shared styles
 *
 * Created once in HomeScreen and passed to all sub-components.
 * This avoids redundant StyleSheet.create calls per component.
 */
import { type ImageStyle, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import { createAuthBaseStyles } from '@/components/auth/authStyles';
import { borderRadius, shadows, spacing, type ThemeColors, typography } from '@/theme';
import { componentSizes, fixed } from '@/theme/tokens';

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
  // Hero CTA
  heroCta: ViewStyle;
  heroCtaText: TextStyle;
  heroCtaIcon: ViewStyle;
  // Action Row (dual compact cards)
  actionRow: ViewStyle;
  actionCard: ViewStyle;
  actionCardDisabled: ViewStyle;
  actionCardIcon: ViewStyle;
  actionCardTitle: TextStyle;
  actionCardSubtitle: TextStyle;
  // Menu (settings list item)
  menu: ViewStyle;
  menuItem: ViewStyle;
  menuItemDisabled: ViewStyle;
  menuIcon: ViewStyle;
  menuIconText: TextStyle;
  menuContent: ViewStyle;
  menuTitle: TextStyle;
  menuSubtitle: TextStyle;
  divider: ViewStyle;
  modalOverlay: ViewStyle;
  modalContent: ViewStyle;
  modalTitle: TextStyle;
  modalSubtitle: TextStyle;
  codeDisplay: ViewStyle;
  codeDigitBox: ViewStyle;
  codeDigitText: TextStyle;
  modalButtons: ViewStyle;
  modalButtonFlex: ViewStyle;
  primaryButton: ViewStyle;
  primaryButtonText: TextStyle;
  secondaryButton: ViewStyle;
  secondaryButtonText: TextStyle;
  input: TextStyle;
  passwordWrapper: ViewStyle;
  passwordInput: TextStyle;
  eyeButton: ViewStyle;
  errorText: TextStyle;
  buttonDisabled: ViewStyle;
  linkButton: ViewStyle;
  linkButtonText: TextStyle;
  outlineButton: ViewStyle;
  outlineButtonText: TextStyle;
  // Auth shared (AuthStyles-compatible aliases)
  formContainer: ViewStyle;
  formTitle: TextStyle;
  formSubtitle: TextStyle;
  emailDomainDropdown: ViewStyle;
  emailDomainItem: ViewStyle;
  emailDomainText: TextStyle;
  buttonCaption: TextStyle;
  buttonCaptionInverse: TextStyle;
  // Footer
  footer: ViewStyle;
  footerText: TextStyle;
  footerLink: ViewStyle;
  footerLinkText: TextStyle;
  // Install guide
  guideSteps: ViewStyle;
  guideStepRow: ViewStyle;
  guideStepNumber: TextStyle;
  guideStepText: TextStyle;
}

export function createHomeScreenStyles(colors: ThemeColors, screenWidth: number): HomeScreenStyles {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      overflow: 'hidden',
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
      lineHeight: typography.lineHeights.hero,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    subtitle: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
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
      width: componentSizes.avatar.sm,
      height: componentSizes.avatar.sm,
      borderRadius: borderRadius.medium,
      marginRight: spacing.small,
      overflow: 'hidden',
    },
    userAvatarPlaceholder: {
      width: componentSizes.avatar.sm,
      height: componentSizes.avatar.sm,
      borderRadius: borderRadius.medium,
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
      lineHeight: typography.lineHeights.body,
      fontWeight: typography.weights.semibold,
      color: colors.textInverse,
      marginLeft: spacing.small,
    },
    // Hero CTA — full-width pill primary button
    heroCta: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      marginHorizontal: spacing.medium,
      marginBottom: spacing.medium,
      paddingVertical: spacing.medium,
      paddingHorizontal: spacing.large,
      borderRadius: borderRadius.full,
      gap: spacing.small,
      ...shadows.md,
    },
    heroCtaText: {
      fontSize: typography.subtitle,
      lineHeight: typography.lineHeights.subtitle,
      fontWeight: typography.weights.semibold,
      color: colors.textInverse,
    },
    heroCtaIcon: {
      marginRight: spacing.tight,
    },
    // Action Row — dual compact cards
    actionRow: {
      flexDirection: 'row',
      marginHorizontal: spacing.medium,
      marginBottom: spacing.medium,
      gap: spacing.small,
    },
    actionCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      padding: spacing.medium,
      alignItems: 'center',
      gap: spacing.small,
      ...shadows.sm,
    },
    actionCardDisabled: {
      opacity: 0.4,
    },
    actionCardIcon: {
      width: componentSizes.button.md,
      height: componentSizes.button.md,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionCardTitle: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      textAlign: 'center',
    },
    actionCardSubtitle: {
      fontSize: typography.captionSmall,
      lineHeight: typography.lineHeights.captionSmall,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    // Menu — settings list
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
    menuItemDisabled: {
      opacity: 0.4,
    },
    menuIcon: {
      width: componentSizes.button.md,
      height: componentSizes.button.md,
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
      lineHeight: typography.lineHeights.body,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    menuSubtitle: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.textSecondary,
      marginTop: spacing.micro,
    },
    divider: {
      height: fixed.divider,
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
      maxWidth: Math.min(400, screenWidth * 0.85),
    },
    modalTitle: {
      fontSize: typography.title,
      lineHeight: typography.lineHeights.title,
      fontWeight: typography.weights.bold,
      color: colors.text,
      textAlign: 'center',
    },
    modalSubtitle: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
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
      width: componentSizes.button.lg,
      height: componentSizes.button.lg + spacing.small,
      backgroundColor: colors.background,
      borderRadius: borderRadius.medium,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: fixed.borderWidthThick,
      borderColor: colors.border,
    },
    codeDigitText: {
      fontSize: typography.hero,
      lineHeight: typography.lineHeights.hero,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    modalButtons: {
      flexDirection: 'row',
      gap: spacing.small,
    },
    modalButtonFlex: {
      flex: 1,
    },
    // Auth shared styles (base + HomeScreen overrides)
    ...createAuthBaseStyles(colors),
    primaryButton: {
      backgroundColor: colors.primary,
      padding: spacing.medium,
      borderRadius: borderRadius.full,
      alignItems: 'center',
    },
    primaryButtonText: {
      color: colors.textInverse,
      fontSize: typography.body,
      lineHeight: typography.lineHeights.body,
      fontWeight: typography.weights.semibold,
    },
    secondaryButton: {
      backgroundColor: colors.background,
      padding: spacing.medium,
      borderRadius: borderRadius.medium,
      alignItems: 'center',
      marginTop: spacing.small,
    },
    secondaryButtonText: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: typography.lineHeights.body,
      fontWeight: typography.weights.medium,
    },
    formTitle: {
      ...createAuthBaseStyles(colors).formTitle,
      fontSize: typography.title,
      lineHeight: typography.lineHeights.title,
      fontWeight: typography.weights.bold,
    },
    linkButton: {
      padding: spacing.small,
      alignItems: 'center',
    },
    linkButtonText: {
      color: colors.primary,
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      fontWeight: typography.weights.medium,
    },
    outlineButton: {
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      padding: spacing.medium,
      borderRadius: borderRadius.medium,
      alignItems: 'center',
      marginTop: spacing.small,
    },
    outlineButtonText: {
      color: colors.textSecondary,
      fontSize: typography.body,
      lineHeight: typography.lineHeights.body,
      fontWeight: typography.weights.medium,
    },
    footer: {
      alignItems: 'center',
      paddingVertical: spacing.xlarge,
      paddingBottom: spacing.xxlarge,
    },
    footerText: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.textMuted,
    },
    footerLink: {
      flexDirection: 'row',
      alignItems: 'center',
      marginTop: spacing.small,
      gap: spacing.tight,
    },
    footerLinkText: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.primary,
    },
    guideSteps: {
      gap: spacing.medium,
      marginBottom: spacing.large,
    },
    guideStepRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
    },
    guideStepNumber: {
      fontSize: typography.heading,
      lineHeight: typography.lineHeights.heading,
    },
    guideStepText: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.text,
      flex: 1,
    },
  });
}
