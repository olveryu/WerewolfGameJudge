/** Token-based styles for the Pictionary configuration screen. */

import { StyleSheet } from 'react-native';

import { gameSettingsStyles } from '@/components/GameSettings.styles';
import { colors, spacing, typography } from '@/theme';

export const pictionaryConfigStyles = StyleSheet.create({
  section: gameSettingsStyles.section,
  sectionTitle: gameSettingsStyles.label,
  sectionHint: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    color: colors.textMuted,
  },
  optionRow: gameSettingsStyles.optionRow,
  option: gameSettingsStyles.option,
  optionSelected: gameSettingsStyles.optionSelected,
  optionText: gameSettingsStyles.optionText,
  optionTextSelected: gameSettingsStyles.optionTextSelected,
  estimate: {
    marginTop: spacing.large,
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: colors.text,
  },
});
