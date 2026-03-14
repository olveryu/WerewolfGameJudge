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
  // Avatar picker
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
  pickerTabBar: ViewStyle;
  pickerTab: ViewStyle;
  pickerTabActive: ViewStyle;
  pickerTabText: TextStyle;
  pickerTabTextActive: TextStyle;
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
      paddingVertical: spacing.medium,
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
      fontSize: typography.subtitle,
      lineHeight: typography.lineHeights.subtitle,
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
      overflow: 'hidden',
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
      bottom: spacing.small,
      right: 0,
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
    // Avatar picker
    pickerOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    pickerSheet: {
      backgroundColor: colors.background,
      borderTopLeftRadius: borderRadius.large,
      borderTopRightRadius: borderRadius.large,
      maxHeight: '75%',
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
    pickerTabBar: {
      flexDirection: 'row',
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      gap: spacing.small,
    },
    pickerTab: {
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.tight,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surface,
    },
    pickerTabActive: {
      backgroundColor: colors.primary,
    },
    pickerTabText: {
      ...textStyles.secondary,
      color: colors.textSecondary,
    },
    pickerTabTextActive: {
      ...textStyles.secondarySemibold,
      color: colors.textInverse,
    },
  });
