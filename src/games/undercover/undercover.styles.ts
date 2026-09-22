/** Shared Undercover presentation tokens; layout remains responsive within the room shell. */
import { StyleSheet } from 'react-native';

import { borderRadius, colors, spacing, typography } from '@/theme';

export const undercoverStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: spacing.large,
    gap: spacing.large,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.medium,
    flexWrap: 'wrap',
  },
  title: { color: colors.text, fontSize: typography.title },
  text: { color: colors.text, fontSize: typography.body },
  muted: { color: colors.textSecondary, fontSize: typography.secondary },
  word: {
    color: colors.text,
    fontSize: typography.hero,
    textAlign: 'center',
    paddingVertical: spacing.large,
  },
  input: {
    color: colors.text,
    fontSize: typography.title,
    padding: spacing.small,
    textAlign: 'center',
    width: 80,
    backgroundColor: colors.surface,
    borderRadius: borderRadius.small,
  },
  section: { gap: spacing.medium },
  modal: { width: 440, maxWidth: '94%', maxHeight: '85%' },
  footer: { padding: spacing.medium, gap: spacing.small },
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
    padding: spacing.large,
    gap: spacing.large,
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
