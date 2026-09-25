/** Shared Story Relay workspace geometry and typography, built from the application tokens. */

import { StyleSheet } from 'react-native';

import { borderRadius, colors, fixed, spacing, textStyles } from '@/theme';

export const storyRelayStyles = StyleSheet.create({
  container: { flex: 1, minHeight: 0 },
  content: {
    width: '100%',
    maxWidth: 800,
    alignSelf: 'center',
    padding: spacing.medium,
    gap: spacing.medium,
  },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.small },
  task: { flex: 1, minHeight: 0, paddingVertical: spacing.small, gap: spacing.small },
  progressList: { paddingHorizontal: spacing.medium, gap: spacing.small },
  progressItem: { paddingVertical: spacing.tight, gap: spacing.tight },
  title: { ...textStyles.subtitleSemibold, color: colors.text, flexShrink: 1 },
  text: { ...textStyles.body, color: colors.text },
  muted: { ...textStyles.secondary, color: colors.textSecondary },
  error: { ...textStyles.secondary, color: colors.error },
  previous: {
    flex: 1,
    maxHeight: '28%',
    minHeight: 0,
    borderLeftWidth: fixed.borderWidthThick,
    borderLeftColor: colors.primary,
    paddingLeft: spacing.medium,
    paddingVertical: spacing.small,
  },
  previousScroll: { flex: 1, minHeight: 0 },
  editor: {
    flex: 1,
    minHeight: 0,
    ...textStyles.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: fixed.borderWidth,
    borderRadius: borderRadius.small,
    padding: spacing.medium,
    textAlignVertical: 'top',
  },
  controls: {
    borderTopWidth: fixed.borderWidth,
    borderTopColor: colors.borderLight,
    padding: spacing.small,
    gap: spacing.small,
  },
  list: { padding: spacing.medium, gap: spacing.small },
  entry: {
    borderBottomWidth: fixed.borderWidth,
    borderBottomColor: colors.borderLight,
    paddingVertical: spacing.medium,
    gap: spacing.small,
  },
  selected: { backgroundColor: colors.surfaceHover },
});
