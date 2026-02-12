/**
 * SettingsScreen shared styles
 *
 * Created once in parent, passed to all sub-components to avoid redundant StyleSheet.create calls.
 */
import { ImageStyle,StyleSheet, TextStyle, ViewStyle } from 'react-native';

import { borderRadius, shadows, spacing, ThemeColors,typography } from '@/theme';
import { componentSizes, fixed } from '@/theme/tokens';

export interface SettingsScreenStyles {
  container: ViewStyle;
  header: ViewStyle;
  backBtn: ViewStyle;
  backBtnText: TextStyle;
  title: TextStyle;
  placeholder: ViewStyle;
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
  // Auth form
  authForm: ViewStyle;
  authTitle: TextStyle;
  input: TextStyle;
  errorText: TextStyle;
  authBtn: ViewStyle;
  authBtnDisabled: ViewStyle;
  authBtnText: TextStyle;
  switchAuthBtn: ViewStyle;
  switchAuthText: TextStyle;
  cancelAuthBtn: ViewStyle;
  cancelAuthText: TextStyle;
  // Auth options
  authOptions: ViewStyle;
  authOptionBtn: ViewStyle;
  authOptionBtnSecondary: ViewStyle;
  authOptionIcon: TextStyle;
  authOptionText: TextStyle;
  authOptionTextSecondary: TextStyle;
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
      padding: spacing.medium,
      backgroundColor: colors.surface,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
    },
    backBtn: {
      width: componentSizes.avatar.md,
      height: componentSizes.avatar.md,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    backBtnText: {
      fontSize: typography.title,
      color: colors.text,
    },
    title: {
      flex: 1,
      fontSize: typography.subtitle,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      textAlign: 'center',
    },
    placeholder: {
      width: componentSizes.avatar.md,
    },
    scrollView: {
      flex: 1,
      padding: spacing.medium,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      padding: spacing.medium,
      marginBottom: spacing.medium,
      ...shadows.sm,
    },
    cardTitle: {
      fontSize: typography.body,
      fontWeight: typography.weights.semibold,
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
      color: colors.textSecondary,
    },
    accountValue: {
      fontSize: typography.secondary,
      color: colors.text,
      fontFamily: 'monospace',
    },
    statusBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.success + '20',
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
      color: colors.success,
    },
    logoutBtn: {
      marginTop: spacing.medium,
      padding: spacing.medium,
      backgroundColor: colors.background,
      borderRadius: borderRadius.medium,
      alignItems: 'center',
    },
    logoutBtnText: {
      fontSize: typography.secondary,
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
      color: colors.textSecondary,
    },
    infoValue: {
      fontSize: typography.secondary,
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
    },
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.tight,
    },
    userName: {
      fontSize: typography.subtitle,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    editIcon: {
      fontSize: typography.secondary,
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
      color: colors.text,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
    },
    saveBtn: {
      backgroundColor: colors.primary,
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      borderRadius: borderRadius.medium,
    },
    saveBtnText: {
      color: colors.textInverse,
      fontSize: typography.secondary,
      fontWeight: typography.weights.medium,
    },
    cancelBtn: {
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.small,
    },
    cancelBtnText: {
      color: colors.textSecondary,
      fontSize: typography.secondary,
    },
    // Auth form
    authForm: {
      paddingVertical: spacing.medium,
    },
    authTitle: {
      fontSize: typography.subtitle,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      textAlign: 'center',
      marginBottom: spacing.large,
    },
    input: {
      height: spacing.xxlarge,
      backgroundColor: colors.background,
      borderRadius: borderRadius.medium,
      paddingHorizontal: spacing.medium,
      fontSize: typography.body,
      color: colors.text,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      marginBottom: spacing.medium,
    },
    errorText: {
      color: colors.error,
      fontSize: typography.secondary,
      textAlign: 'center',
      marginBottom: spacing.medium,
    },
    authBtn: {
      backgroundColor: colors.primary,
      height: spacing.xxlarge,
      borderRadius: borderRadius.medium,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: spacing.medium,
    },
    authBtnDisabled: {
      opacity: 0.6,
    },
    authBtnText: {
      color: colors.textInverse,
      fontSize: typography.body,
      fontWeight: typography.weights.semibold,
    },
    switchAuthBtn: {
      alignItems: 'center',
      paddingVertical: spacing.small,
    },
    switchAuthText: {
      color: colors.primary,
      fontSize: typography.secondary,
    },
    cancelAuthBtn: {
      alignItems: 'center',
      paddingVertical: spacing.small,
    },
    cancelAuthText: {
      color: colors.textSecondary,
      fontSize: typography.secondary,
    },
    // Auth options
    authOptions: {
      gap: spacing.medium,
      paddingVertical: spacing.medium,
    },
    authOptionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      height: spacing.xxlarge,
      borderRadius: borderRadius.medium,
      gap: spacing.small,
    },
    authOptionBtnSecondary: {
      backgroundColor: colors.background,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
    },
    authOptionIcon: {
      fontSize: typography.title,
    },
    authOptionText: {
      color: colors.textInverse,
      fontSize: typography.body,
      fontWeight: typography.weights.medium,
    },
    authOptionTextSecondary: {
      color: colors.text,
      fontSize: typography.body,
      fontWeight: typography.weights.medium,
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
      color: colors.text,
    },
    themeValue: {
      fontSize: typography.secondary,
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
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.background,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
    },
    themeOptionActive: {
      borderColor: colors.primary,
      backgroundColor: colors.primary + '20',
    },
    themeOptionText: {
      fontSize: typography.secondary,
      color: colors.text,
    },
    themeOptionTextActive: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
  });
