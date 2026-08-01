/** Stable geometry for the shared room frame. */

import { StyleSheet } from 'react-native';

import {
  borderRadius,
  createSharedStyles,
  fixed,
  layout,
  spacing,
  type ThemeColors,
  typography,
} from '@/theme';

export function createRoomShellStyles(colors: ThemeColors) {
  const shared = createSharedStyles(colors);
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.transparent,
      overflow: 'hidden',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.screenH,
      paddingVertical: layout.headerPaddingV,
      backgroundColor: colors.surface,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
      overflow: 'hidden',
    },
    iconButton: {
      ...shared.iconButton,
      borderRadius: borderRadius.full,
      overflow: 'hidden',
      zIndex: 1,
    },
    headerCenter: {
      ...StyleSheet.absoluteFill,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: layout.headerTitleSize,
      lineHeight: layout.headerTitleLineHeight,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    headerSide: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
      zIndex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      padding: spacing.medium,
      paddingBottom: spacing.xxlarge + spacing.xlarge,
    },
  });
}
