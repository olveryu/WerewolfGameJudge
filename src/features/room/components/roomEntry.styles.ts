/** Shared resolved-room entry boundary styles. */

import { StyleSheet } from 'react-native';

import { borderRadius, colors, spacing, textStyles } from '@/theme';

export const roomEntryStyles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.large,
    backgroundColor: colors.background,
  },
  errorText: {
    ...textStyles.body,
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.large,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.medium,
  },
  authOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.large,
    backgroundColor: colors.overlay,
  },
  authPanel: {
    width: '100%',
    maxWidth: 400,
    padding: spacing.large,
    borderRadius: borderRadius.medium,
    backgroundColor: colors.surface,
  },
  authTitle: {
    ...textStyles.titleBold,
    color: colors.text,
    textAlign: 'center',
  },
  authSubtitle: {
    ...textStyles.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.tight,
    marginBottom: spacing.large,
  },
});
