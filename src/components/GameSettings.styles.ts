/** Werewolf-aligned settings surfaces; presentation only, no validation or state. */
import { StyleSheet } from 'react-native';

import { borderRadius, colors, spacing, textStyles, withAlpha } from '@/theme';
import { componentSizes, fixed } from '@/theme/tokens';

export const gameSettingsStyles = StyleSheet.create({
  content: { paddingTop: spacing.small },
  section: {
    paddingVertical: spacing.medium,
    borderBottomWidth: fixed.borderWidth,
    borderBottomColor: colors.border,
    gap: spacing.small,
  },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.small,
    paddingVertical: spacing.small,
  },
  label: { ...textStyles.bodySemibold, color: colors.text, flexShrink: 1 },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.full,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    padding: spacing.micro,
    marginLeft: 'auto',
  },
  count: {
    ...textStyles.bodySemibold,
    color: colors.primary,
    width: componentSizes.button.lg,
    flexShrink: 0,
    height: componentSizes.button.md,
    lineHeight: componentSizes.button.md,
    textAlign: 'center',
    paddingHorizontal: spacing.tight,
    paddingVertical: 0,
    backgroundColor: withAlpha(colors.primary, 0.08),
    borderRadius: borderRadius.small,
  },
  hint: { ...textStyles.caption, color: colors.textSecondary },
  summary: {
    ...textStyles.caption,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.small,
  },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.small },
  option: {
    minHeight: componentSizes.button.md,
    paddingHorizontal: componentSizes.chip.paddingH,
    paddingVertical: componentSizes.chip.paddingV,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.tight,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.full,
    backgroundColor: colors.background,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: withAlpha(colors.primary, 0.15) },
  optionText: { ...textStyles.secondary, color: colors.textSecondary },
  optionTextSelected: { ...textStyles.secondarySemibold, color: colors.primary },
});
