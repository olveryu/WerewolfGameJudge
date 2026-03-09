/**
 * Bottom-sheet styles — settings sheet, settings chips.
 *
 * Used by SettingsSheet and TemplatePicker.
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
});
