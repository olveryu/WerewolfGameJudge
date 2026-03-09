/**
 * Status panel styles — BottomActionPanel, ConnectionStatusBar, ControlledSeatBanner.
 */
import { StyleSheet } from 'react-native';

import { borderRadius, shadows, spacing, type ThemeColors, typography, withAlpha } from '@/theme';
import { componentSizes, fixed } from '@/theme/tokens';

import type {
  BottomActionPanelStyles,
  ConnectionStatusBarStyles,
  ControlledSeatBannerStyles,
} from './styles';

export function createStatusPanelStyles(colors: ThemeColors): {
  bottomActionPanel: BottomActionPanelStyles;
  connectionStatusBar: ConnectionStatusBarStyles;
  controlledSeatBanner: ControlledSeatBannerStyles;
} {
  return {
    bottomActionPanel: StyleSheet.create<BottomActionPanelStyles>({
      container: {
        backgroundColor: withAlpha(colors.surface, 0.8),
        borderTopLeftRadius: borderRadius.large,
        borderTopRightRadius: borderRadius.large,
        paddingTop: spacing.medium,
        paddingHorizontal: spacing.medium,
        paddingBottom: spacing.medium,
        borderTopWidth: fixed.borderWidth,
        borderTopColor: colors.borderLight,
        overflow: 'hidden',
        ...shadows.upward,
      },
      message: {
        textAlign: 'center',
        fontSize: typography.body,
        lineHeight: typography.lineHeights.body,
        color: colors.text,
        marginBottom: spacing.small,
        paddingHorizontal: spacing.small,
      },
      buttonRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: spacing.small,
      },
      secondaryRow: {
        width: '100%',
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: spacing.small,
      },
    }),

    connectionStatusBar: StyleSheet.create<ConnectionStatusBarStyles>({
      container: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: spacing.tight,
        paddingHorizontal: spacing.medium,
        backgroundColor: withAlpha(colors.error, 0.125),
        borderRadius: borderRadius.large,
        marginHorizontal: spacing.medium,
        marginTop: spacing.small,
        overflow: 'hidden',
        ...shadows.sm,
      },
      text: {
        fontSize: typography.secondary,
        lineHeight: typography.lineHeights.secondary,
        color: colors.error,
        fontWeight: typography.weights.medium,
      },
      progressBarTrack: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: componentSizes.progressBar.height,
      },
      progressBar: {
        height: componentSizes.progressBar.height,
        backgroundColor: withAlpha(colors.error, 0.5),
        borderRadius: componentSizes.progressBar.borderRadius,
      },
    }),

    controlledSeatBanner: StyleSheet.create<ControlledSeatBannerStyles>({
      container: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: withAlpha(colors.warning, 0.125),
        borderWidth: fixed.borderWidth,
        borderColor: colors.warning,
        paddingVertical: spacing.small,
        paddingHorizontal: spacing.medium,
        marginHorizontal: spacing.medium,
        marginBottom: spacing.small,
        borderRadius: borderRadius.large,
        ...shadows.sm,
      },
      hintContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: withAlpha(colors.warning, 0.125),
        borderWidth: fixed.borderWidth,
        borderColor: colors.warning,
        paddingVertical: spacing.small,
        paddingHorizontal: spacing.medium,
        marginHorizontal: spacing.medium,
        marginBottom: spacing.small,
        borderRadius: borderRadius.large,
        ...shadows.sm,
      },
      text: {
        fontSize: typography.secondary,
        lineHeight: typography.lineHeights.secondary,
        color: colors.text,
        fontWeight: typography.weights.semibold,
        flex: 1,
      },
      hintText: {
        fontSize: typography.secondary,
        lineHeight: typography.lineHeights.secondary,
        color: colors.text,
        fontWeight: typography.weights.semibold,
      },
      releaseButton: {
        backgroundColor: colors.surface,
        paddingVertical: spacing.tight,
        paddingHorizontal: spacing.small,
        borderRadius: borderRadius.medium,
      },
      releaseButtonText: {
        fontSize: typography.caption,
        lineHeight: typography.lineHeights.caption,
        color: colors.text,
        fontWeight: typography.weights.semibold,
      },
    }),
  };
}
