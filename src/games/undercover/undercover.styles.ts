/** Shared Undercover presentation tokens; layout remains responsive within the room shell. */
import { StyleSheet } from 'react-native';

import { roomSurfaceStyles } from '@/features/room/components/RoomSurface.styles';
import { borderRadius, colors, spacing, textStyles } from '@/theme';

export const undercoverStyles = StyleSheet.create({
  title: roomSurfaceStyles.title,
  text: roomSurfaceStyles.body,
  muted: roomSurfaceStyles.status,
  word: {
    ...textStyles.titleBold,
    color: colors.text,
    textAlign: 'center',
    paddingVertical: spacing.large,
  },
  section: roomSurfaceStyles.section,
  revealOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
    backgroundColor: colors.overlay,
  },
  revealOverlayWide: { justifyContent: 'center', padding: spacing.large },
  revealPanel: {
    width: '100%',
    maxHeight: '85%',
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderTopLeftRadius: borderRadius.large,
    borderTopRightRadius: borderRadius.large,
  },
  revealPanelWide: { maxWidth: 440, borderRadius: borderRadius.large },
  revealIdentity: { flexDirection: 'row', alignItems: 'center', gap: spacing.medium },
  revealName: { flex: 1, minWidth: 0, gap: spacing.small },
  revealActions: { flexDirection: 'row', gap: spacing.medium },
  revealAction: { flex: 1, minWidth: 0 },
});
