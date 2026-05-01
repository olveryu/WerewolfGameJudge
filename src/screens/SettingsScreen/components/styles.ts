/**
 * SettingsScreen shared styles
 *
 * Created once in parent, passed to all sub-components to avoid redundant StyleSheet.create calls.
 */
import { type ImageStyle, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import { createAuthBaseStyles } from '@/components/auth/authStyles';
import {
  borderRadius,
  componentSizes,
  createSharedStyles,
  fixed,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
  withAlpha,
} from '@/theme';

export interface SettingsScreenStyles {
  container: ViewStyle;
  scrollView: ViewStyle;
  scrollContent: ViewStyle;
  card: ViewStyle;
  cardTitle: TextStyle;
  accountRow: ViewStyle;
  accountLabel: TextStyle;
  accountValue: TextStyle;
  statusBadge: ViewStyle;
  statusDot: ViewStyle;
  statusText: TextStyle;
  logoutBtn: ViewStyle;
  infoRow: ViewStyle;
  infoLabel: TextStyle;
  infoValue: TextStyle;
  // Profile section
  profileSection: ViewStyle;
  avatar: ImageStyle;
  avatarPlaceholder: ViewStyle;
  avatarPlaceholderIcon: TextStyle;
  avatarEditBadge: ViewStyle;
  avatarEditIcon: TextStyle;
  nameRow: ViewStyle;
  userName: TextStyle;
  editIcon: TextStyle;
  // Auth form (AuthStyles-compatible)
  formContainer: ViewStyle;
  formTitle: TextStyle;
  formSubtitle: TextStyle;
  input: TextStyle;
  passwordWrapper: ViewStyle;
  passwordWrapperFocused: ViewStyle;
  passwordInputContainer: ViewStyle;
  passwordInput: TextStyle;
  eyeButton: ViewStyle;
  emailDomainDropdown: ViewStyle;
  emailDomainItem: ViewStyle;
  emailDomainText: TextStyle;
  errorText: TextStyle;
  primaryButton: ViewStyle;
  primaryButtonText: TextStyle;
  secondaryButton: ViewStyle;
  secondaryButtonText: TextStyle;
  linkButton: ViewStyle;
  linkButtonText: TextStyle;
  outlineButton: ViewStyle;
  outlineButtonText: TextStyle;
  buttonDisabled: ViewStyle;
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
  // About section
  aboutRow: ViewStyle;
  aboutLabel: TextStyle;
  aboutValue: TextStyle;
  aboutValueRow: ViewStyle;

  // Avatar preview strip (anonymous user teaser)
  avatarPreviewSection: ViewStyle;
  avatarPreviewCard: ViewStyle;
  avatarPreviewRow: ViewStyle;
  avatarPreviewItem: ImageStyle;
  avatarPreviewLockBadge: ViewStyle;
  avatarPreviewDesc: TextStyle;
  avatarPreviewUpgradeBtn: ViewStyle;
  avatarPreviewUpgradeBtnText: TextStyle;
  avatarPreviewCta: TextStyle;
  // Settings account horizontal profile row
  profileRow: ViewStyle;
  profileRowRight: ViewStyle;
  profileRowName: ViewStyle;
  // Settings dresser entry row
  dresserEntry: ViewStyle;
  dresserEntryContent: ViewStyle;
  dresserEntryText: TextStyle;
  dresserEntryDesc: TextStyle;
  dresserEntryChevron: TextStyle;
  dresserEntryRight: ViewStyle;
  dresserEntryBadge: ViewStyle;
  dresserEntryBadgeText: TextStyle;
  // Level pill (inline next to name)
  levelPill: ViewStyle;
  levelPillText: TextStyle;
  // Growth section
  growthEntryContent: ViewStyle;
  growthMiniProgress: ViewStyle;
  growthMiniProgressFill: ViewStyle;
  growthXpRow: ViewStyle;
  growthXpLabel: TextStyle;
  growthProgressBarBg: ViewStyle;
  growthProgressBarFill: ViewStyle;
  growthXpValue: TextStyle;
}

export const createSettingsScreenStyles = (colors: ThemeColors): SettingsScreenStyles =>
  StyleSheet.create<SettingsScreenStyles>({
    container: {
      flex: 1,
      backgroundColor: colors.transparent,
      overflow: 'hidden',
    },
    scrollView: {
      flex: 1,
      padding: spacing.screenH,
      backgroundColor: colors.transparent,
    },
    scrollContent: {
      flexGrow: 1,
    },
    card: {
      ...createSharedStyles(colors).cardBase,
      marginBottom: spacing.screenH,
    },
    cardTitle: {
      ...textStyles.subtitleSemibold,
      color: colors.text,
      marginBottom: spacing.medium,
    },
    accountRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.small,
    },
    accountLabel: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.textSecondary,
    },
    accountValue: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.text,
      fontFamily: 'monospace',
    },

    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: withAlpha(colors.success, 0.125),
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.tight,
      borderRadius: borderRadius.full,
    },
    statusDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      backgroundColor: colors.success,
      marginRight: spacing.tight,
    },
    statusText: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.success,
    },
    logoutBtn: {
      marginTop: spacing.medium,
      padding: spacing.medium,
      backgroundColor: colors.background,
      borderRadius: borderRadius.full,
      alignItems: 'center',
    },
    infoRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.small,
    },
    infoLabel: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.textSecondary,
    },
    infoValue: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.text,
    },
    // Profile section
    profileSection: {
      alignItems: 'center',
      paddingVertical: spacing.medium,
      marginBottom: spacing.medium,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
    },
    avatar: {
      width: componentSizes.avatar.xl,
      height: componentSizes.avatar.xl,
      borderRadius: borderRadius.medium,
      marginBottom: spacing.small,
      overflow: 'visible' as const,
    },
    avatarPlaceholder: {
      width: componentSizes.avatar.xl,
      height: componentSizes.avatar.xl,
      borderRadius: borderRadius.full,
      backgroundColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.small,
    },
    avatarPlaceholderIcon: {
      fontSize: typography.display,
      lineHeight: typography.lineHeights.display,
    },
    avatarEditBadge: {
      position: 'absolute',
      bottom: -spacing.tight,
      right: -spacing.small,
      width: componentSizes.icon.lg,
      height: componentSizes.icon.lg,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: fixed.borderWidthThick,
      borderColor: colors.border,
    },
    avatarEditIcon: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.tight,
    },
    userName: {
      ...textStyles.subtitleSemibold,
      color: colors.text,
    },
    editIcon: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
    },

    // Auth form (base + SettingsScreen overrides)
    ...createAuthBaseStyles(colors),
    formContainer: {
      paddingVertical: spacing.medium,
    },
    formTitle: {
      ...createAuthBaseStyles(colors).formTitle,
      marginBottom: spacing.large,
    },
    emailDomainDropdown: {
      ...createAuthBaseStyles(colors).emailDomainDropdown,
      marginTop: -spacing.small,
      marginBottom: spacing.medium,
    },
    errorText: {
      ...createAuthBaseStyles(colors).errorText,
      marginBottom: spacing.medium,
    },
    // About section
    aboutRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.small,
    },
    aboutLabel: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.textSecondary,
    },
    aboutValue: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.text,
    },
    aboutValueRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.tight,
    },

    // Avatar preview (anonymous user teaser in AvatarSection)
    avatarPreviewSection: {
      alignItems: 'center',
    },
    avatarPreviewCard: {
      alignItems: 'center',
      marginTop: spacing.medium,
      paddingVertical: spacing.medium,
      paddingHorizontal: spacing.medium,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
    },
    avatarPreviewRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
    },
    avatarPreviewItem: {
      width: componentSizes.avatar.sm,
      height: componentSizes.avatar.sm,
      borderRadius: borderRadius.small,
    },
    avatarPreviewLockBadge: {
      width: componentSizes.avatar.sm,
      height: componentSizes.avatar.sm,
      borderRadius: borderRadius.small,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarPreviewDesc: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.textSecondary,
      textAlign: 'center',
      marginTop: spacing.small,
    },
    avatarPreviewUpgradeBtn: {
      backgroundColor: colors.primary,
      paddingVertical: spacing.small,
      paddingHorizontal: spacing.large,
      borderRadius: borderRadius.full,
      alignSelf: 'center',
      marginTop: spacing.small,
    },
    avatarPreviewUpgradeBtnText: {
      ...textStyles.secondarySemibold,
      color: colors.textInverse,
    },
    avatarPreviewCta: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.primary,
      fontWeight: typography.weights.medium,
      marginTop: spacing.tight,
    },
    // Settings account horizontal profile row
    profileRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.medium,
      marginBottom: spacing.medium,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
      gap: spacing.medium,
    },
    profileRowRight: {
      flex: 1,
      gap: spacing.tight,
    },
    profileRowName: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.tight,
    },
    // Settings dresser entry row
    dresserEntry: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.medium,
      paddingHorizontal: spacing.medium,
      backgroundColor: withAlpha(colors.primary, 0.06),
      borderRadius: borderRadius.medium,
      marginBottom: spacing.medium,
      borderWidth: fixed.borderWidth,
      borderColor: withAlpha(colors.primary, 0.1),
    },
    dresserEntryContent: {
      flex: 1,
    },
    dresserEntryText: {
      ...textStyles.body,
      color: colors.text,
    },
    dresserEntryDesc: {
      ...textStyles.caption,
      color: colors.textMuted,
      marginTop: spacing.tight,
    },
    dresserEntryChevron: {
      color: colors.textMuted,
    },
    dresserEntryRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
    },
    dresserEntryBadge: {
      minWidth: componentSizes.badge.sm,
      height: componentSizes.badge.sm,
      borderRadius: componentSizes.badge.sm / 2,
      paddingHorizontal: spacing.micro,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.error,
    },
    dresserEntryBadgeText: {
      fontSize: typography.captionSmall,
      fontWeight: typography.weights.bold,
      color: colors.textInverse,
    },
    // Level pill (inline next to name)
    levelPill: {
      backgroundColor: withAlpha(colors.primary, 0.1),
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.micro,
      borderRadius: borderRadius.full,
    },
    levelPillText: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      fontWeight: typography.weights.semibold,
      color: colors.primary,
    },
    // Growth section
    growthEntryContent: {
      flex: 1,
      marginHorizontal: spacing.small,
    },
    growthMiniProgress: {
      height: 5,
      backgroundColor: withAlpha(colors.primary, 0.1),
      borderRadius: borderRadius.full,
      overflow: 'hidden',
      marginTop: spacing.tight,
    },
    growthMiniProgressFill: {
      height: '100%',
      backgroundColor: colors.primary,
      borderRadius: borderRadius.full,
    },
    growthXpRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
      marginBottom: spacing.medium,
    },
    growthXpLabel: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.textSecondary,
    },
    growthProgressBarBg: {
      flex: 1,
      height: 10,
      backgroundColor: withAlpha(colors.primary, 0.08),
      borderRadius: borderRadius.full,
      overflow: 'hidden',
    },
    growthProgressBarFill: {
      height: '100%',
      backgroundColor: colors.primaryLight,
      borderRadius: borderRadius.full,
    },
    growthXpValue: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.textSecondary,
      minWidth: spacing.xxlarge,
      textAlign: 'right',
    },
  });
