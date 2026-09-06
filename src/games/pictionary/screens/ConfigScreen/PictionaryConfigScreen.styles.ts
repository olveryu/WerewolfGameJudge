/** Token-based styles for the Pictionary configuration screen. */

import { StyleSheet } from 'react-native';

import {
  borderRadius,
  colors,
  componentSizes,
  fixed,
  spacing,
  typography,
  withAlpha,
} from '@/theme';

export const pictionaryConfigStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    paddingHorizontal: spacing.screenH,
    paddingTop: spacing.large,
    paddingBottom: spacing.xxlarge,
    gap: spacing.large,
  },
  eyebrow: {
    fontSize: typography.caption,
    lineHeight: typography.lineHeights.caption,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },
  title: {
    fontSize: typography.title,
    lineHeight: typography.lineHeights.title,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  description: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    color: colors.textSecondary,
  },
  section: {
    paddingVertical: spacing.medium,
    borderTopWidth: fixed.borderWidth,
    borderTopColor: colors.border,
    gap: spacing.small,
  },
  sectionTitle: {
    fontSize: typography.body,
    lineHeight: typography.lineHeights.body,
    fontWeight: typography.weights.semibold,
    color: colors.text,
  },
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
    padding: spacing.medium,
    borderRadius: borderRadius.small,
    backgroundColor: withAlpha(colors.info, 0.08),
    fontSize: typography.secondary,
    lineHeight: typography.lineHeights.secondary,
    color: colors.text,
  },
  bottomBar: {
    paddingHorizontal: spacing.screenH,
    paddingTop: spacing.small,
    borderTopWidth: fixed.borderWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  submit: { width: '100%', maxWidth: 760, alignSelf: 'center' },
});
