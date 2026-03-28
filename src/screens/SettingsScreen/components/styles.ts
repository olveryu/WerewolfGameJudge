/**
 * SettingsScreen shared styles
 *
 * Created once in parent, passed to all sub-components to avoid redundant StyleSheet.create calls.
 */
import { ImageStyle, StyleSheet, TextStyle, ViewStyle } from 'react-native';

import { createAuthBaseStyles } from '@/components/auth/authStyles';
import {
  borderRadius,
  componentSizes,
  createSharedStyles,
  fixed,
  layout,
  spacing,
  textStyles,
  ThemeColors,
  typography,
  withAlpha,
} from '@/theme';

export interface SettingsScreenStyles {
  container: ViewStyle;
  header: ViewStyle;
  backBtn: ViewStyle;
  backBtnText: TextStyle;
  headerTitle: TextStyle;
  headerSpacer: ViewStyle;
  scrollView: ViewStyle;
  card: ViewStyle;
  cardTitle: TextStyle;
  accountRow: ViewStyle;
  accountLabel: TextStyle;
  accountValue: TextStyle;
  statusBadge: ViewStyle;
  statusDot: ViewStyle;
  statusText: TextStyle;
  logoutBtn: ViewStyle;
  logoutBtnText: TextStyle;
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
  editNameRow: ViewStyle;
  nameInput: TextStyle;
  saveBtn: ViewStyle;
  saveBtnText: TextStyle;
  cancelBtn: ViewStyle;
  cancelBtnText: TextStyle;
  // Auth form (AuthStyles-compatible)
  formContainer: ViewStyle;
  formTitle: TextStyle;
  formSubtitle: TextStyle;
  input: TextStyle;
  passwordWrapper: ViewStyle;
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
  avatarStripText: TextStyle;
  // Theme section
  themeSection: ViewStyle;
  themeRow: ViewStyle;
  themeLabel: TextStyle;
  themeValue: TextStyle;
  themeOptions: ViewStyle;
  themeOption: ViewStyle;
  themeOptionActive: ViewStyle;
  themeOptionText: TextStyle;
  themeOptionTextActive: TextStyle;
  // About section
  aboutRow: ViewStyle;
  aboutLabel: TextStyle;
  aboutValue: TextStyle;
  bottomSpacer: ViewStyle;
  // [DIAG]
  diagBanner: ViewStyle;
  diagText: TextStyle;
  // Avatar picker
  pickerModalRoot: ViewStyle;
  pickerOverlay: ViewStyle;
  pickerSheet: ViewStyle;
  pickerHandle: ViewStyle;
  pickerHeader: ViewStyle;
  pickerTitle: TextStyle;
  pickerCloseBtn: ViewStyle;
  pickerGrid: ViewStyle;
  pickerItem: ViewStyle;
  pickerItemImage: ImageStyle;
  pickerItemSelected: ViewStyle;
  pickerCheckBadge: ViewStyle;
  pickerUploadItem: ViewStyle;
  pickerUploadImage: ImageStyle;
  pickerUploadOverlay: ViewStyle;
  pickerSectionTitle: TextStyle;
  pickerCustomSection: ViewStyle;
  pickerCustomRow: ViewStyle;
  pickerCustomItem: ViewStyle;
  pickerCustomUploadItem: ViewStyle;
  pickerPreviewOverlay: ViewStyle;
  pickerPreviewImage: ImageStyle;
  pickerFooter: ViewStyle;
  pickerConfirmBtn: ViewStyle;
  pickerConfirmBtnDisabled: ViewStyle;
  pickerConfirmBtnText: TextStyle;
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
  // Avatar frame picker (fixed below scroll area)
  frameSection: ViewStyle;
  frameSectionTitle: TextStyle;
  frameRow: ViewStyle;
  frameCell: ViewStyle;
  frameCellSelected: ViewStyle;
  frameCellActive: ViewStyle;
  frameName: TextStyle;
  frameNameSelected: TextStyle;
  frameNoFrameIcon: ViewStyle;
  // Picker tab bar
  pickerTabBar: ViewStyle;
  pickerTab: ViewStyle;
  pickerTabActive: ViewStyle;
  pickerTabText: TextStyle;
  pickerTabTextActive: TextStyle;
  pickerTabIndicator: ViewStyle;
  // Hero preview area
  heroPreview: ViewStyle;
  heroPreviewLeft: ViewStyle;
  heroPreviewRight: ViewStyle;
  heroDisplayName: TextStyle;
  heroFrameLabel: TextStyle;
  heroUploadBtn: ViewStyle;
  heroUploadBtnText: TextStyle;
  // Frame grid (3×2 in frame tab)
  frameGrid: ViewStyle;
  frameGridCell: ViewStyle;
  frameGridCellSelected: ViewStyle;
  frameGridCellActive: ViewStyle;
  frameGridName: TextStyle;
  frameGridNameSelected: TextStyle;
  frameGridNoFrame: ViewStyle;
  // ReadOnly upgrade card in picker
  pickerUpgradeCard: ViewStyle;
  pickerUpgradeTitle: TextStyle;
  pickerUpgradeBenefits: ViewStyle;
  pickerUpgradeBenefit: TextStyle;
  // Settings account horizontal profile row
  profileRow: ViewStyle;
  profileRowRight: ViewStyle;
  profileRowName: ViewStyle;
  // Settings dresser entry row
  dresserEntry: ViewStyle;
  dresserEntryText: TextStyle;
  dresserEntryChevron: TextStyle;
}

export const createSettingsScreenStyles = (colors: ThemeColors): SettingsScreenStyles =>
  StyleSheet.create<SettingsScreenStyles>({
    container: {
      flex: 1,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.screenH,
      paddingVertical: layout.headerPaddingV,
      backgroundColor: colors.surface,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
    },
    backBtn: {
      ...createSharedStyles(colors).iconButton,
      borderRadius: borderRadius.full,
      overflow: 'hidden',
    },
    backBtnText: {
      fontSize: typography.title,
      lineHeight: typography.lineHeights.title,
      color: colors.text,
    },
    headerTitle: {
      flex: 1,
      fontSize: layout.headerTitleSize,
      lineHeight: layout.headerTitleLineHeight,
      fontWeight: typography.weights.bold,
      color: colors.text,
      textAlign: 'center',
    },
    headerSpacer: {
      width: componentSizes.avatar.md,
      height: componentSizes.avatar.md,
    },
    scrollView: {
      flex: 1,
      padding: spacing.screenH,
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
    logoutBtnText: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.error,
      fontWeight: typography.weights.medium,
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
    editNameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
    },
    nameInput: {
      flex: 1,
      height: componentSizes.avatar.md,
      backgroundColor: colors.background,
      borderRadius: borderRadius.medium,
      paddingHorizontal: spacing.small,
      fontSize: typography.body,
      lineHeight: typography.lineHeights.body,
      color: colors.text,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      borderRadius: borderRadius.full,
    },
    saveBtnText: {
      color: colors.textInverse,
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      fontWeight: typography.weights.medium,
    },
    cancelBtn: {
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.small,
    },
    cancelBtnText: {
      color: colors.textSecondary,
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
    outlineButton: {
      backgroundColor: colors.background,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      height: componentSizes.button.lg,
      borderRadius: borderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.medium,
    },
    outlineButtonText: {
      ...textStyles.bodyMedium,
      color: colors.text,
    },
    // Theme section
    themeSection: {
      paddingVertical: spacing.small,
    },
    themeRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: spacing.small,
    },
    themeLabel: {
      fontSize: typography.body,
      lineHeight: typography.lineHeights.body,
      color: colors.text,
    },
    themeValue: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.primary,
      fontWeight: typography.weights.medium,
    },
    themeOptions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.small,
      marginTop: spacing.small,
    },
    themeOption: {
      flexBasis: '22%',
      flexGrow: 1,
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.background,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
    },
    themeOptionActive: {
      borderColor: colors.primary,
      backgroundColor: withAlpha(colors.primary, 0.125),
    },
    themeOptionText: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.text,
      textAlign: 'center',
    },
    themeOptionTextActive: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
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
    bottomSpacer: {
      height: spacing.xlarge,
    },
    // [DIAG]
    diagBanner: {
      backgroundColor: colors.error,
      padding: spacing.small,
      marginBottom: spacing.small,
      borderRadius: borderRadius.small,
    },
    diagText: {
      color: colors.surface,
      fontFamily: 'monospace',
      fontSize: typography.caption,
    },
    // Avatar picker
    pickerModalRoot: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    pickerOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
    },
    pickerSheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: borderRadius.large,
      borderTopRightRadius: borderRadius.large,
      maxHeight: '85%',
      paddingBottom: spacing.xlarge,
    },
    pickerHandle: {
      width: componentSizes.handle.width,
      height: componentSizes.handle.height,
      backgroundColor: colors.textMuted,
      borderRadius: borderRadius.full,
      alignSelf: 'center',
      marginTop: spacing.small,
      marginBottom: spacing.small,
    },
    pickerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.screenH,
      paddingBottom: spacing.small,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
    },
    pickerTitle: {
      ...textStyles.subtitleSemibold,
      color: colors.text,
    },
    pickerCloseBtn: {
      padding: spacing.tight,
    },
    pickerGrid: {
      paddingHorizontal: spacing.medium,
      paddingTop: spacing.medium,
    },
    pickerItem: {
      flex: 1,
      aspectRatio: 1,
      margin: spacing.tight,
      borderRadius: borderRadius.medium,
      overflow: 'hidden',
      borderWidth: fixed.borderWidthThick,
      borderColor: colors.background,
    },
    pickerItemImage: {
      width: '100%',
      height: '100%',
      borderRadius: borderRadius.medium - fixed.borderWidthThick,
    },
    pickerItemSelected: {
      borderColor: colors.primary,
    },
    pickerCheckBadge: {
      position: 'absolute',
      bottom: spacing.micro,
      right: spacing.micro,
      width: componentSizes.icon.md,
      height: componentSizes.icon.md,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    pickerUploadItem: {
      flex: 1,
      aspectRatio: 1,
      margin: spacing.tight,
      borderRadius: borderRadius.medium,
      borderWidth: fixed.borderWidthThick,
      borderColor: colors.border,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surface,
      overflow: 'hidden',
    },
    pickerUploadImage: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: borderRadius.medium - fixed.borderWidthThick,
    },
    pickerUploadOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: borderRadius.medium - fixed.borderWidthThick,
    },
    pickerSectionTitle: {
      ...textStyles.secondarySemibold,
      color: colors.textSecondary,
      paddingHorizontal: spacing.tight,
      paddingTop: spacing.medium,
      paddingBottom: spacing.tight,
    },
    pickerCustomSection: {
      paddingHorizontal: spacing.tight,
      paddingBottom: spacing.small,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
    },
    pickerCustomRow: {
      flexDirection: 'row',
      gap: spacing.small,
    },
    pickerCustomItem: {
      width: componentSizes.avatar.xl,
      height: componentSizes.avatar.xl,
      borderRadius: borderRadius.medium,
      overflow: 'hidden',
      borderWidth: fixed.borderWidthThick,
      borderColor: colors.background,
    },
    pickerCustomUploadItem: {
      width: componentSizes.avatar.xl,
      height: componentSizes.avatar.xl,
      borderRadius: borderRadius.medium,
      borderWidth: fixed.borderWidthThick,
      borderColor: colors.border,
      borderStyle: 'dashed',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: colors.surface,
    },
    pickerPreviewOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    pickerPreviewImage: {
      width: 200,
      height: 200,
      borderRadius: borderRadius.medium,
    },
    pickerFooter: {
      paddingHorizontal: spacing.screenH,
      paddingTop: spacing.medium,
      borderTopWidth: fixed.borderWidth,
      borderTopColor: colors.border,
    },
    pickerConfirmBtn: {
      backgroundColor: colors.primary,
      height: componentSizes.button.md,
      borderRadius: borderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    pickerConfirmBtnDisabled: {
      opacity: fixed.disabledOpacity,
    },
    pickerConfirmBtnText: {
      ...textStyles.bodyMedium,
      color: colors.textInverse,
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
    // Avatar frame picker (fixed below scroll area)
    frameSection: {
      paddingHorizontal: spacing.medium,
      paddingTop: spacing.small,
      paddingBottom: spacing.small,
      borderTopWidth: fixed.borderWidth,
      borderTopColor: colors.border,
    },
    frameSectionTitle: {
      ...textStyles.secondarySemibold,
      color: colors.textSecondary,
      marginBottom: spacing.tight,
    },
    frameRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.small,
      justifyContent: 'center',
    },
    frameCell: {
      alignItems: 'center',
      padding: spacing.tight,
      borderRadius: borderRadius.medium,
      borderWidth: fixed.borderWidthThick,
      borderColor: colors.background,
    },
    frameCellSelected: {
      borderColor: colors.primary,
    },
    frameCellActive: {
      borderColor: withAlpha(colors.primary, 0.4),
    },
    frameName: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.textSecondary,
      marginTop: spacing.micro,
      textAlign: 'center',
    },
    frameNameSelected: {
      color: colors.primary,
      fontWeight: typography.weights.medium,
    },
    frameNoFrameIcon: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    // Picker tab bar (头像 / 头像框)
    pickerTabBar: {
      flexDirection: 'row',
      paddingHorizontal: spacing.screenH,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
    },
    pickerTab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.small,
    },
    pickerTabActive: {
      // active state — no background, uses indicator
    },
    pickerTabText: {
      ...textStyles.bodyMedium,
      color: colors.textSecondary,
    },
    pickerTabTextActive: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    pickerTabIndicator: {
      position: 'absolute',
      bottom: 0,
      left: spacing.medium,
      right: spacing.medium,
      height: fixed.borderWidthThick,
      backgroundColor: colors.primary,
      borderRadius: fixed.borderWidth,
    },
    // Hero preview area
    heroPreview: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.screenH,
      paddingVertical: spacing.small,
      gap: spacing.medium,
    },
    heroPreviewLeft: {
      alignItems: 'center',
      overflow: 'visible' as const,
    },
    heroPreviewRight: {
      flex: 1,
      gap: spacing.tight,
    },
    heroDisplayName: {
      ...textStyles.bodyMedium,
      color: colors.text,
    },
    heroFrameLabel: {
      ...textStyles.caption,
      color: colors.textSecondary,
    },
    heroUploadBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.tight,
      marginTop: spacing.small,
    },
    heroUploadBtnText: {
      ...textStyles.secondary,
      color: colors.primary,
      fontWeight: typography.weights.medium,
    },
    // Frame grid (3×2 in frame tab)
    frameGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      justifyContent: 'center',
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.medium,
      gap: spacing.medium,
    },
    frameGridCell: {
      alignItems: 'center',
      padding: spacing.small,
      borderRadius: borderRadius.medium,
      borderWidth: fixed.borderWidthThick,
      borderColor: colors.background,
      overflow: 'visible' as const,
    },
    frameGridCellSelected: {
      borderColor: colors.primary,
      backgroundColor: withAlpha(colors.primary, 0.08),
    },
    frameGridCellActive: {
      borderColor: withAlpha(colors.primary, 0.4),
    },
    frameGridName: {
      ...textStyles.caption,
      color: colors.textSecondary,
      marginTop: spacing.tight,
      textAlign: 'center',
    },
    frameGridNameSelected: {
      color: colors.primary,
      fontWeight: typography.weights.medium,
    },
    frameGridNoFrame: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    // ReadOnly upgrade card in picker
    pickerUpgradeCard: {
      marginHorizontal: spacing.screenH,
      marginTop: spacing.medium,
      paddingVertical: spacing.medium,
      paddingHorizontal: spacing.medium,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      gap: spacing.small,
    },
    pickerUpgradeTitle: {
      ...textStyles.secondarySemibold,
      color: colors.text,
    },
    pickerUpgradeBenefits: {
      gap: spacing.tight,
    },
    pickerUpgradeBenefit: {
      ...textStyles.caption,
      color: colors.textSecondary,
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
      backgroundColor: colors.background,
      borderRadius: borderRadius.medium,
      marginBottom: spacing.medium,
    },
    dresserEntryText: {
      ...textStyles.body,
      color: colors.text,
    },
    dresserEntryChevron: {
      color: colors.textMuted,
    },
  });
