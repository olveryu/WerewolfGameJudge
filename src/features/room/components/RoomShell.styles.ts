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

const ROOM_SIDE_INSPECTOR_WIDTH = 360;

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
    headerStacked: {
      flexDirection: 'column',
      alignItems: 'stretch',
      gap: spacing.tight,
    },
    headerTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
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
    headerCenterCompact: {
      flex: 1,
      minWidth: 0,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerCenterStacked: {
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.tight,
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
    roomContent: {
      flex: 1,
      minHeight: 0,
      flexDirection: 'row',
    },
    boardColumn: {
      flex: 1,
      minWidth: 0,
    },
    contextHeaderContainer: {
      paddingHorizontal: spacing.medium,
      paddingTop: spacing.small,
    },
    sideInspectorContainer: {
      width: ROOM_SIDE_INSPECTOR_WIDTH,
      minHeight: 0,
      backgroundColor: colors.surface,
      borderLeftWidth: fixed.borderWidth,
      borderLeftColor: colors.border,
    },
    scrollContent: {
      flexGrow: 1,
      padding: spacing.medium,
      paddingBottom: spacing.xxlarge + spacing.xlarge,
    },
  });
}
