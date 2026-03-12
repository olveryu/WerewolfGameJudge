/**
 * Dropdown & modal styles — settings selector, bottom-sheet modal.
 *
 * Used by Dropdown and TemplatePicker components.
 */
import type { TextStyle, ViewStyle } from 'react-native';

import {
  borderRadius,
  fixed,
  layout,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
  withAlpha,
} from '@/theme';

export const createDropdownStyles = (colors: ThemeColors) => ({
  // ── Settings row ────────────────────────────
  settingsRow: {
    flexDirection: 'row',
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: spacing.small,
    backgroundColor: colors.surface,
    borderBottomWidth: fixed.borderWidth,
    borderBottomColor: colors.border,
    gap: spacing.medium,
  } satisfies ViewStyle,
  settingsItem: {
    flex: 1,
  } satisfies ViewStyle,
  settingsLabel: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.textSecondary,
    marginBottom: spacing.tight,
  } satisfies TextStyle,
  settingsSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.small,
    paddingVertical: spacing.small,
    backgroundColor: colors.background,
    borderRadius: borderRadius.medium,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
  } satisfies ViewStyle,
  settingsSelectorText: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: colors.text,
    flex: 1,
  } satisfies TextStyle,
  settingsSelectorArrow: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: colors.textSecondary,
    marginLeft: spacing.tight,
  } satisfies TextStyle,

  // ── Modal (Dropdown / TemplatePicker) ──────
  modalOverlay: {
    flex: 1,
    backgroundColor: colors.overlayLight,
    justifyContent: 'flex-end',
  } satisfies ViewStyle,
  modalContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.large,
    borderTopRightRadius: borderRadius.large,
    paddingBottom: spacing.xlarge,
    maxHeight: '60%',
  } satisfies ViewStyle,
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: spacing.medium,
    borderBottomWidth: fixed.borderWidth,
    borderBottomColor: colors.border,
  } satisfies ViewStyle,
  modalTitle: {
    ...textStyles.subtitleSemibold,
    color: colors.text,
  } satisfies TextStyle,
  modalCloseBtn: {
    padding: spacing.small,
  } satisfies ViewStyle,
  modalCloseBtnText: {
    fontSize: typography.title,
    lineHeight: typography.lineHeights.title,
    color: colors.textSecondary,
  } satisfies TextStyle,
  modalOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: spacing.medium,
    borderBottomWidth: fixed.borderWidth,
    borderBottomColor: colors.border,
  } satisfies ViewStyle,
  modalOptionSelected: {
    backgroundColor: withAlpha(colors.primaryLight, 0.125),
  } satisfies ViewStyle,
  modalOptionText: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    color: colors.text,
  } satisfies TextStyle,
  modalOptionTextSelected: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  } satisfies TextStyle,
  modalOptionCheck: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    color: colors.primary,
  } satisfies TextStyle,
});
