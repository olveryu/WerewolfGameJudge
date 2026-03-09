/**
 * Bottom-sheet styles — settings sheet, settings chips, variant picker, role info.
 *
 * Used by SettingsSheet, VariantPicker, RoleInfoSheet, and TemplatePicker.
 */
import type { TextStyle, ViewStyle } from 'react-native';

import { borderRadius, layout, spacing, type ThemeColors, typography, withAlpha } from '@/theme';
import { componentSizes, fixed } from '@/theme/tokens';

export const createSheetStyles = (colors: ThemeColors) => ({
  // ── Settings sheet (Animation + BGM) ──────
  settingsSheetOverlay: {
    flex: 1,
    backgroundColor: colors.overlayLight,
    justifyContent: 'flex-end',
  } satisfies ViewStyle,
  settingsSheetContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.large,
    borderTopRightRadius: borderRadius.large,
    paddingHorizontal: layout.screenPaddingH,
    paddingBottom: spacing.xlarge,
  } satisfies ViewStyle,
  settingsSheetHandle: {
    width: componentSizes.button.sm + spacing.tight,
    height: spacing.tight,
    borderRadius: spacing.tight / 2,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginVertical: spacing.small + spacing.tight / 2,
  } satisfies ViewStyle,
  settingsSheetTitle: {
    fontSize: typography.subtitle,
    lineHeight: typography.lineHeights.subtitle,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.medium,
  } satisfies TextStyle,

  // ── Settings chip group (SettingsSheet / TemplatePicker) ──
  settingsChipGroup: {
    marginBottom: spacing.medium,
  } satisfies ViewStyle,
  settingsChipGroupLabel: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
    marginBottom: spacing.small,
  } satisfies TextStyle,
  settingsChipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small,
  } satisfies ViewStyle,
  settingsChip: {
    flexBasis: '22%',
    flexGrow: 1,
    maxWidth: '24%',
    alignItems: 'center',
    paddingHorizontal: spacing.small,
    paddingVertical: componentSizes.chip.paddingV,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    backgroundColor: colors.background,
  } satisfies ViewStyle,
  settingsChipSelected: {
    backgroundColor: withAlpha(colors.primary, 0.125),
    borderColor: colors.primary,
  } satisfies ViewStyle,
  settingsChipText: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: colors.textSecondary,
    fontWeight: typography.weights.medium,
    textAlign: 'center',
  } satisfies TextStyle,
  settingsChipTextSelected: {
    color: colors.primary,
    fontWeight: typography.weights.semibold,
  } satisfies TextStyle,

  // ── Variant picker (bottom sheet) ────────────
  variantPickerOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlayLight,
  } satisfies ViewStyle,
  variantPickerContent: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.large,
    borderTopRightRadius: borderRadius.large,
    paddingBottom: spacing.xlarge,
  } satisfies ViewStyle,
  variantPickerHandle: {
    width: componentSizes.handle.width,
    height: componentSizes.handle.height,
    borderRadius: borderRadius.small,
    backgroundColor: colors.border,
    alignSelf: 'center',
    marginTop: spacing.small,
    marginBottom: spacing.small,
  } satisfies ViewStyle,
  variantPickerTitle: {
    fontSize: typography.subtitle,
    lineHeight: typography.lineHeights.subtitle,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: spacing.medium,
  } satisfies TextStyle,
  variantPickerOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: layout.screenPaddingH,
    paddingVertical: spacing.medium,
  } satisfies ViewStyle,
  variantPickerOptionSelected: {
    backgroundColor: withAlpha(colors.primary, 0.063),
  } satisfies ViewStyle,
  variantPickerRadio: {
    width: componentSizes.radio.size,
    height: componentSizes.radio.size,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidthThick,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.medium,
  } satisfies ViewStyle,
  variantPickerRadioSelected: {
    borderColor: colors.primary,
  } satisfies ViewStyle,
  variantPickerRadioDot: {
    width: componentSizes.radio.dotSize,
    height: componentSizes.radio.dotSize,
    borderRadius: borderRadius.full,
    backgroundColor: colors.primary,
  } satisfies ViewStyle,
  variantPickerOptionContent: {
    flex: 1,
  } satisfies ViewStyle,
  variantPickerOptionName: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  } satisfies TextStyle,
  variantPickerOptionDesc: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.textSecondary,
    marginTop: spacing.tight / 2,
  } satisfies TextStyle,

  // ── Role info sheet ──────────────────────────
  roleInfoDesc: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.subtitle,
    color: colors.textSecondary,
    paddingHorizontal: layout.screenPaddingH,
    paddingBottom: spacing.large,
  } satisfies TextStyle,
});
