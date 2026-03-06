/**
 * HomeScreen shared styles
 *
 * Created once in HomeScreen and passed to all sub-components.
 * This avoids redundant StyleSheet.create calls per component.
 */
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import { createAuthBaseStyles } from '@/components/auth/authStyles';
import { borderRadius, shadows, spacing, type ThemeColors, typography } from '@/theme';
import { componentSizes, fixed } from '@/theme/tokens';

export interface HomeScreenStyles {
  container: ViewStyle;
  scrollView: ViewStyle;
  // Top Bar (brand + action icons)
  topBar: ViewStyle;
  topBarBrand: ViewStyle;
  topBarLogo: TextStyle;
  topBarTitle: TextStyle;
  topBarActions: ViewStyle;
  topBarButton: ViewStyle;
  // Greeting
  greeting: ViewStyle;
  greetingName: TextStyle;
  greetingSub: TextStyle;
  // User identity (login state, keep testIDs for E2E)
  loginPrompt: ViewStyle;
  loginPromptText: TextStyle;
  userNameHidden: TextStyle;
  // Hero Card (create room — primary accent)
  heroCard: ViewStyle;
  heroCardContent: ViewStyle;
  heroCardTitle: TextStyle;
  heroCardSubtitle: TextStyle;
  heroCardArrow: ViewStyle;
  // Action Row (dual compact cards)
  actionRow: ViewStyle;
  actionCard: ViewStyle;
  actionCardDisabled: ViewStyle;
  actionCardIcon: ViewStyle;
  actionCardTitle: TextStyle;
  actionCardSubtitle: TextStyle;
  // Modal
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
    // ── Top Bar ──────────────────────────────────────────────
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.screenH,
      paddingTop: spacing.small,
      paddingBottom: spacing.small,
    },
    topBarBrand: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
    },
    topBarLogo: {
      fontSize: 28,
    },
    topBarTitle: {
      fontSize: typography.subtitle,
      lineHeight: typography.lineHeights.subtitle,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    topBarActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.tight,
    },
    topBarButton: {
      width: componentSizes.button.sm,
      height: componentSizes.button.sm,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // ── Greeting ─────────────────────────────────────────────
    greeting: {
      paddingHorizontal: spacing.screenH,
      paddingTop: spacing.large,
      paddingBottom: spacing.medium,
    },
    greetingName: {
      fontSize: typography.heading,
      lineHeight: typography.lineHeights.heading,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    greetingSub: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.textMuted,
      marginTop: spacing.tight,
    },
    // ── User identity (hidden helpers for testIDs / E2E) ─────
    loginPrompt: {
      display: 'none',
    },
    loginPromptText: {
      display: 'none',
    },
    userNameHidden: {
      display: 'none',
    },
    // ── Hero Card ────────────────────────────────────────────
    heroCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.primary,
      marginHorizontal: spacing.screenH,
      marginBottom: spacing.medium,
      padding: spacing.medium,
      borderRadius: borderRadius.large,
      ...shadows.md,
    },
    heroCardContent: {
      flex: 1,
      gap: spacing.tight,
    },
    heroCardTitle: {
      fontSize: typography.subtitle,
      lineHeight: typography.lineHeights.subtitle,
      fontWeight: typography.weights.semibold,
      color: colors.textInverse,
    },
    heroCardSubtitle: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.textInverse,
      opacity: 0.8,
    },
    heroCardArrow: {
      width: componentSizes.button.md,
      height: componentSizes.button.md,
      borderRadius: borderRadius.full,
      backgroundColor: 'rgba(255,255,255,0.2)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    // ── Action Row ───────────────────────────────────────────
    actionRow: {
      flexDirection: 'row',
      marginHorizontal: spacing.screenH,
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
    // ── Modal ────────────────────────────────────────────────
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
