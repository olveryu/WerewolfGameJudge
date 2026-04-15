/**
 * HomeScreen shared styles
 *
 * Created once in HomeScreen and passed to all sub-components.
 * This avoids redundant StyleSheet.create calls per component.
 */
import { type ImageStyle, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import { createAuthBaseStyles } from '@/components/auth/authStyles';
import {
  borderRadius,
  componentSizes,
  createSharedStyles,
  fixed,
  layout,
  shadows,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
  withAlpha,
} from '@/theme';

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
  // User identity (login state, keep testIDs for E2E)

  userNameHidden: TextStyle;
  // Hero Card (create room — primary gradient accent)
  heroCard: ViewStyle;
  heroCardGradient: ViewStyle;
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
  passwordWrapperFocused: ViewStyle;
  passwordInputContainer: ViewStyle;
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
  buttonCaptionInverseMuted: TextStyle;
  // Avatar preview card (LoginOptions)
  avatarStripContainer: ViewStyle;
  avatarStripRow: ViewStyle;
  avatarStripImage: ImageStyle;
  avatarStripImageWrapper: ViewStyle;
  avatarStripLockOverlay: ViewStyle;
  avatarStripLockIcon: TextStyle;
  avatarStripText: TextStyle;
  avatarStripLink: TextStyle;
  // Random Role Card (F8 — flip animation)
  randomRoleWrapper: ViewStyle;
  randomRoleCard: ViewStyle;
  randomRoleCardAbsolute: ViewStyle;
  randomRoleBackContent: ViewStyle;
  randomRoleBackEmoji: TextStyle;
  randomRoleBackText: TextStyle;
  randomRoleFrontRow: ViewStyle;
  randomRoleAvatar: ImageStyle;
  randomRoleFrontInfo: ViewStyle;
  randomRoleNameRow: ViewStyle;
  randomRoleName: TextStyle;
  randomRoleBadge: ViewStyle;
  randomRoleBadgeText: TextStyle;
  randomRoleDesc: TextStyle;
  randomRoleActions: ViewStyle;
  randomRoleActionBtn: ViewStyle;
  randomRoleActionText: TextStyle;
  // Tip Card (contextual tips between action row and footer)
  tipCard: ViewStyle;
  tipCardIcon: ViewStyle;
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
      backgroundColor: colors.background,
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
      paddingVertical: layout.headerPaddingV,
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
      fontSize: layout.headerTitleSize,
      lineHeight: layout.headerTitleLineHeight,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    topBarActions: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
    },
    userNameHidden: {
      position: 'absolute',
      width: 1,
      height: 1,
      overflow: 'hidden',
    },
    // ── Hero Card (gradient bg via LinearGradient child) ──
    heroCard: {
      overflow: 'hidden',
      borderRadius: borderRadius.large,
      marginHorizontal: spacing.screenH,
      marginTop: spacing.medium,
      marginBottom: spacing.large,
      ...shadows.lg,
    },
    heroCardGradient: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.medium,
    },
    heroCardContent: {
      flex: 1,
      gap: spacing.tight,
    },
    heroCardTitle: {
      ...textStyles.titleBold,
      color: colors.textInverse,
    },
    heroCardSubtitle: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: withAlpha(colors.textInverse, 0.8),
    },
    heroCardArrow: {
      width: componentSizes.button.md,
      height: componentSizes.button.md,
      borderRadius: borderRadius.large,
      backgroundColor: withAlpha(colors.textInverse, 0.2),
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
      ...shared.cardBase,
      flex: 1,
      alignItems: 'center',
      gap: spacing.small,
    },
    actionCardDisabled: {
      opacity: fixed.disabledOpacity,
    },
    actionCardIcon: {
      width: componentSizes.button.md,
      height: componentSizes.button.md,
      borderRadius: borderRadius.large,
      backgroundColor: withAlpha(colors.primary, 0.1),
      justifyContent: 'center',
      alignItems: 'center',
    },
    actionCardTitle: {
      ...textStyles.bodySemibold,
      color: colors.text,
      textAlign: 'center',
    },
    actionCardSubtitle: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.textSecondary,
      textAlign: 'center',
    },
    // ── Random Role Card ─────────────────────────────────────
    randomRoleWrapper: {
      marginHorizontal: spacing.screenH,
      marginBottom: spacing.medium,
      height: componentSizes.avatar.xl + spacing.xlarge + spacing.medium,
    },
    randomRoleCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      padding: spacing.medium,
      ...shadows.sm,
    },
    randomRoleCardAbsolute: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
    },
    randomRoleBackContent: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.small,
    },
    randomRoleBackEmoji: {
      fontSize: typography.display,
    },
    randomRoleBackText: {
      ...textStyles.bodySemibold,
      color: colors.textSecondary,
    },
    randomRoleFrontRow: {
      flexDirection: 'row',
      gap: spacing.small,
    },
    randomRoleAvatar: {
      width: componentSizes.avatar.lg,
      height: componentSizes.avatar.lg,
      borderRadius: borderRadius.medium,
    },
    randomRoleFrontInfo: {
      flex: 1,
      gap: spacing.tight,
    },
    randomRoleNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
    },
    randomRoleName: {
      ...textStyles.bodySemibold,
      color: colors.text,
    },
    randomRoleBadge: {
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.micro,
      borderRadius: borderRadius.small,
    },
    randomRoleBadgeText: {
      fontSize: typography.captionSmall,
      lineHeight: typography.lineHeights.captionSmall,
      fontWeight: typography.weights.medium,
    },
    randomRoleDesc: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.textSecondary,
    },
    randomRoleActions: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginTop: spacing.small,
    },
    randomRoleActionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.tight,
      paddingVertical: spacing.tight,
    },
    randomRoleActionText: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      fontWeight: typography.weights.medium,
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
      borderLeftWidth: fixed.borderWidthHighlight,
      borderLeftColor: colors.primary,
      gap: spacing.small,
      ...shadows.sm,
    },
    tipCardIcon: {
      width: componentSizes.avatar.md,
      height: componentSizes.avatar.md,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: withAlpha(colors.primary, 0.08),
      borderRadius: borderRadius.medium,
      overflow: 'hidden',
    },
    tipCardBody: {
      flex: 1,
    },
    tipCardTitle: {
      ...textStyles.secondarySemibold,
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
      ...textStyles.titleBold,
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
    secondaryButton: {
      padding: spacing.medium,
      borderRadius: borderRadius.full,
      alignItems: 'center',
    },
    secondaryButtonText: {
      ...textStyles.bodyMedium,
      color: colors.textSecondary,
    },
    formTitle: {
      ...createAuthBaseStyles(colors).formTitle,
      ...textStyles.titleBold,
    },
    formSubtitle: {
      ...createAuthBaseStyles(colors).formSubtitle,
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
      marginBottom: spacing.small,
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
