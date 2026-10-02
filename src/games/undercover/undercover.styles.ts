/** Shared Undercover presentation tokens; layout remains responsive within the room shell. */
import { StyleSheet } from 'react-native';

import { roomSurfaceStyles } from '@/features/room/components/RoomSurface.styles';
import { borderRadius, colors, spacing, textStyles, typography } from '@/theme';

export const undercoverStyles = StyleSheet.create({
  title: roomSurfaceStyles.title,
  text: roomSurfaceStyles.body,
  muted: roomSurfaceStyles.status,
  word: {
    fontSize: typography.heading,
    lineHeight: typography.lineHeights.heading,
    fontWeight: typography.weights.bold,
    color: colors.primary,
    textAlign: 'center',
    paddingVertical: spacing.large,
  },
  section: roomSurfaceStyles.section,
  revealIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.medium },
  revealName: { flex: 1, minWidth: 0, gap: spacing.small },
});
