/**
 * Role selector styles — role chips, stepper, sections.
 *
 * Used by RoleChip, RoleStepper, and Section components.
 */
import type { TextStyle, ViewStyle } from 'react-native';

import { borderRadius, layout, spacing, type ThemeColors, typography, withAlpha } from '@/theme';
import { componentSizes, fixed } from '@/theme/tokens';

export const createRoleSelectorStyles = (colors: ThemeColors) => ({
  // ── Section (inside cardB) ────────────
  section: {
    marginTop: spacing.medium,
  } satisfies ViewStyle,
  sectionTitle: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.text,
    marginBottom: spacing.small,
    paddingHorizontal: layout.cardPadding,
  } satisfies TextStyle,
  sectionCard: {
    paddingHorizontal: layout.cardPadding,
    paddingVertical: spacing.small + spacing.tight,
  } satisfies ViewStyle,
  chipContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.small,
  } satisfies ViewStyle,

  // ── Role chip ────────────────
  chip: {
    flexBasis: '28%',
    flexGrow: 1,
    maxWidth: '32%',
    paddingVertical: componentSizes.chip.paddingV,
    backgroundColor: colors.background,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  } satisfies ViewStyle,
  chipSelected: {
    backgroundColor: withAlpha(colors.primary, 0.125),
    borderColor: colors.primary,
  } satisfies ViewStyle,
  chipSelectedWolf: {
    backgroundColor: withAlpha(colors.wolf, 0.125),
    borderColor: colors.wolf,
  } satisfies ViewStyle,
  chipSelectedGod: {
    backgroundColor: withAlpha(colors.god, 0.125),
    borderColor: colors.god,
  } satisfies ViewStyle,
  chipSelectedVillager: {
    backgroundColor: withAlpha(colors.villager, 0.125),
    borderColor: colors.villager,
  } satisfies ViewStyle,
  chipSelectedNeutral: {
    backgroundColor: withAlpha(colors.third, 0.125),
    borderColor: colors.third,
  } satisfies ViewStyle,
  chipText: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  } satisfies TextStyle,
  chipTextSelected: {
    fontWeight: typography.weights.semibold,
  } satisfies TextStyle,
  chipVariant: {
    borderColor: withAlpha(colors.primary, 0.502),
    borderWidth: fixed.borderWidthThick,
  } satisfies ViewStyle,

  // ── Role stepper ──
  stepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.small + spacing.tight,
    paddingHorizontal: layout.cardPadding,
  } satisfies ViewStyle,
  stepperLabel: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    color: colors.text,
    fontWeight: typography.weights.semibold,
  } satisfies TextStyle,
  stepperPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    paddingHorizontal: spacing.tight / 2,
    paddingVertical: spacing.tight / 2,
  } satisfies ViewStyle,
  stepperControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 0,
  } satisfies ViewStyle,
  stepperBtn: {
    width: spacing.large + spacing.tight,
    height: spacing.large + spacing.tight,
    borderRadius: borderRadius.full,
    justifyContent: 'center',
    alignItems: 'center',
  } satisfies ViewStyle,
  stepperBtnDisabled: {
    opacity: 0.25,
  } satisfies ViewStyle,
  stepperBtnText: {
    fontSize: typography.subtitle,
    lineHeight: typography.lineHeights.subtitle,
    fontWeight: typography.weights.semibold,
  } satisfies TextStyle,
  stepperBtnTextDisabled: {
    color: colors.textMuted,
  } satisfies TextStyle,
  stepperCount: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.bold,
    color: colors.text,
    minWidth: spacing.large,
    textAlign: 'center',
  } satisfies TextStyle,
});
