/** Room detail surfaces aligned with the Werewolf host panel and theme typography. */
import { StyleSheet } from 'react-native';

import { borderRadius, colors, spacing, textStyles } from '@/theme';
import { fixed } from '@/theme/tokens';

const ROOM_DIALOG_WIDTH = 440;

export const roomSurfaceStyles = StyleSheet.create({
  dialog: {
    width: '94%',
    maxWidth: ROOM_DIALOG_WIDTH,
    maxHeight: '85%',
    padding: 0,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.medium,
    paddingHorizontal: spacing.large,
    paddingVertical: spacing.medium,
    borderBottomWidth: fixed.borderWidth,
    borderBottomColor: colors.border,
  },
  heading: { flex: 1, minWidth: 0, gap: spacing.micro },
  title: { ...textStyles.subtitleSemibold, color: colors.text },
  label: { ...textStyles.secondarySemibold, color: colors.textSecondary },
  body: { ...textStyles.body, color: colors.text },
  status: { ...textStyles.caption, color: colors.textSecondary },
  scroll: { flexShrink: 1 },
  content: { padding: spacing.large, gap: spacing.medium },
  footer: {
    padding: spacing.large,
    gap: spacing.small,
    borderTopWidth: fixed.borderWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  section: { gap: spacing.small, paddingVertical: spacing.small },
  timer: {
    minWidth: fixed.minTouchTarget * 2,
    height: fixed.minTouchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.tight,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
  },
  timerText: {
    ...textStyles.secondarySemibold,
    color: colors.textSecondary,
    fontVariant: ['tabular-nums'],
  },
});
