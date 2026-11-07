/** Room detail surfaces aligned with the Werewolf host panel and theme typography. */
import { StyleSheet } from 'react-native';

import { borderRadius, colors, spacing, textStyles } from '@/theme';
import { fixed } from '@/theme/tokens';

const ROOM_DIALOG_MAX_WIDTH = 440;
const ROOM_DIALOG_WIDTH_PERCENT = 94;

/**
 * The room dialog's rendered width for a window width: the dialog is a
 * fraction of the full-window modal overlay, capped. Surfaces that must
 * match a dialog pixel for pixel (the review export page) size from this.
 */
export function resolveRoomDialogWidth(windowWidth: number): number {
  return Math.min((windowWidth * ROOM_DIALOG_WIDTH_PERCENT) / 100, ROOM_DIALOG_MAX_WIDTH);
}

export const roomSurfaceStyles = StyleSheet.create({
  dialog: {
    width: `${ROOM_DIALOG_WIDTH_PERCENT}%`,
    maxWidth: ROOM_DIALOG_MAX_WIDTH,
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
