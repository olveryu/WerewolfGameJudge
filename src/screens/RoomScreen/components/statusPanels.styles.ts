/**
 * Status panel styles — BottomActionPanel, ConnectionStatusBar, ControlledSeatBanner.
 */
import { StyleSheet } from 'react-native';

import {
  borderRadius,
  componentSizes,
  fixed,
  shadows,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
  withAlpha,
} from '@/theme';

import type {
  BottomActionPanelStyles,
  ConnectionStatusBarStyles,
  ControlledSeatBannerStyles,
  HostGuideBannerStyles,
  StatusRibbonStyles,
} from './styles';

export function createStatusPanelStyles(colors: ThemeColors): {
  bottomActionPanel: BottomActionPanelStyles;
  connectionStatusBar: ConnectionStatusBarStyles;
  controlledSeatBanner: ControlledSeatBannerStyles;
  hostGuideBanner: HostGuideBannerStyles;
  statusRibbon: StatusRibbonStyles;
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
        ...shadows.lgUpward,
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
        ...textStyles.secondarySemibold,
        color: colors.text,
        flex: 1,
      },
      hintText: {
        ...textStyles.secondarySemibold,
        color: colors.text,
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

    hostGuideBanner: StyleSheet.create<HostGuideBannerStyles>({
      container: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: withAlpha(colors.info, 0.1),
        paddingVertical: spacing.small,
        paddingHorizontal: spacing.medium,
        marginHorizontal: spacing.medium,
        marginTop: spacing.small,
        borderRadius: borderRadius.large,
      },
      icon: {
        color: colors.info,
        marginRight: spacing.small,
      },
      text: {
        ...textStyles.secondarySemibold,
        color: colors.info,
        flex: 1,
      },
    }),

    statusRibbon: StyleSheet.create<StatusRibbonStyles>({
      speakingOrderContainer: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: withAlpha(colors.warning, 0.1),
        paddingVertical: spacing.small,
        paddingHorizontal: spacing.medium,
        marginHorizontal: spacing.medium,
        marginTop: spacing.small,
        borderRadius: borderRadius.large,
      },
      speakingOrderIcon: {
        color: colors.warning,
        marginRight: spacing.small,
        marginTop: spacing.micro,
      },
      speakingOrderTextContainer: {
        flex: 1,
      },
      speakingOrderText: {
        fontSize: typography.secondary,
        lineHeight: typography.lineHeights.secondary,
        color: colors.warning,
        fontWeight: typography.weights.semibold,
      },
      speakingOrderSubText: {
        fontSize: typography.caption,
        lineHeight: typography.lineHeights.caption,
        color: colors.textMuted,
        marginTop: spacing.micro,
      },
    }),
  };
}
