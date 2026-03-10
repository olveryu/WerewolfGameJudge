/**
 * HomeScreen shared styles
 *
 * Created once in HomeScreen and passed to all sub-components.
 * This avoids redundant StyleSheet.create calls per component.
 */
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import { createAuthBaseStyles } from '@/components/auth/authStyles';
import {
  borderRadius,
  createSharedStyles,
  shadows,
  spacing,
  type ThemeColors,
  typography,
  withAlpha,
} from '@/theme';
import { componentSizes, fixed } from '@/theme/tokens';

export interface HomeScreenStyles {
  container: ViewStyle;
  scrollView: ViewStyle;
  scrollContent: ViewStyle;
  // Top Bar (brand + avatar + settings)
  topBar: ViewStyle;
  topBarBrand: ViewStyle;
  topBarLogo: TextStyle;
  topBarTitle: TextStyle;
  topBarActions: ViewStyle;
  topBarButton: ViewStyle;
  // User identity (login state, keep testIDs for E2E)

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
  // Tip Card (contextual tips between action row and footer)
  tipCard: ViewStyle;
  tipCardIcon: TextStyle;
  tipCardBody: ViewStyle;
  tipCardTitle: TextStyle;
  tipCardSub: TextStyle;
  tipCardClose: ViewStyle;
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
  const shared = createSharedStyles(colors);
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
    },
    // ── Top Bar (standard header: surface bg + border-bottom) ──
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.screenH,
      paddingVertical: spacing.medium,
      backgroundColor: colors.surface,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
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
      gap: spacing.small,
    },
    topBarButton: {
      ...shared.iconButton,
      borderRadius: borderRadius.full,
      overflow: 'hidden',
    },

    userNameHidden: {
      position: 'absolute',
      width: 1,
      height: 1,
      overflow: 'hidden',
    },
    // ── Hero Card (surface bg + elevated shadow, unified with action cards) ──
    heroCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      marginHorizontal: spacing.screenH,
      marginTop: spacing.medium,
      marginBottom: spacing.large,
      padding: spacing.medium,
      borderRadius: borderRadius.large,
      ...shadows.lg,
    },
    heroCardContent: {
      flex: 1,
      gap: spacing.tight,
    },
    heroCardTitle: {
      fontSize: typography.title,
      lineHeight: typography.lineHeights.title,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    heroCardSubtitle: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.textSecondary,
    },
    heroCardArrow: {
      width: componentSizes.button.md,
      height: componentSizes.button.md,
      borderRadius: borderRadius.large,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // ── Action Row ───────────────────────────────────────────
    actionRow: {
      flexDirection: 'row',
      marginHorizontal: spacing.screenH,
      marginBottom: spacing.large,
      gap: spacing.small,
    },
    actionCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      padding: spacing.medium,
      alignItems: 'center',
      gap: spacing.small,
      ...shadows.md,
    },
    actionCardDisabled: {
      opacity: fixed.disabledOpacity,
    },
    actionCardIcon: {
      width: componentSizes.button.md,
      height: componentSizes.button.md,
      borderRadius: borderRadius.medium,
      backgroundColor: withAlpha(colors.primary, 0.06),
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionCardTitle: {
      fontSize: typography.body,
      lineHeight: typography.lineHeights.body,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      textAlign: 'center',
    },
    actionCardSubtitle: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    // ── Tip Card ─────────────────────────────────────────────
    tipCard: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.screenH,
      marginBottom: spacing.small,
      padding: spacing.medium,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      gap: spacing.small,
      ...shadows.sm,
    },
    tipCardIcon: {
      fontSize: typography.title,
      lineHeight: typography.lineHeights.title,
      width: componentSizes.avatar.md,
      height: componentSizes.avatar.md,
      textAlign: 'center',
      textAlignVertical: 'center',
      backgroundColor: withAlpha(colors.primary, 0.08),
      borderRadius: borderRadius.medium,
      overflow: 'hidden',
    },
    tipCardBody: {
      flex: 1,
    },
    tipCardTitle: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    tipCardSub: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.textSecondary,
      marginTop: spacing.micro,
    },
    tipCardClose: {
      padding: spacing.tight,
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
      borderRadius: borderRadius.full,
      alignItems: 'center',
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
      borderRadius: borderRadius.full,
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
      marginTop: 'auto',
      paddingVertical: spacing.medium,
      paddingBottom: spacing.large,
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
