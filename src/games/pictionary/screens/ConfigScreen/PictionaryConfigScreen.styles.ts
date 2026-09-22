/** Token-based styles for the Pictionary configuration screen. */

import { StyleSheet } from 'react-native';

import { gameScreenStyles } from '@/components/GameScreen';
import { borderRadius, colors, spacing, typography, withAlpha } from '@/theme';
import { componentSizes, fixed } from '@/theme/tokens';

export const pictionaryConfigStyles = StyleSheet.create({
  section: gameScreenStyles.section,
  sectionTitle: gameScreenStyles.sectionTitle,
  sectionHint: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.textMuted,
  },
  playerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.small },
  count: {
    flex: 1,
    minWidth: 0,
    height: componentSizes.button.lg,
    textAlign: 'center',
    textAlignVertical: 'center',
    fontSize: typography.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  optionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.small },
  option: {
    minHeight: componentSizes.button.md,
    minWidth: componentSizes.button.lg,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.medium,
    borderWidth: fixed.borderWidth,
    borderColor: colors.border,
    borderRadius: borderRadius.small,
    backgroundColor: colors.surface,
  },
  optionSelected: {
    borderColor: colors.primary,
    backgroundColor: withAlpha(colors.primary, 0.1),
  },
  optionText: {
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  optionTextSelected: { color: colors.primary, fontWeight: typography.weights.bold },
  estimate: {
    marginTop: spacing.large,
    padding: spacing.medium,
    borderRadius: borderRadius.small,
    backgroundColor: withAlpha(colors.info, 0.08),
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: colors.text,
  },
});
