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
  RoomProgressIndicatorStyles,
  StatusRibbonStyles,
} from './styles';

export function createStatusPanelStyles(colors: ThemeColors): {
  bottomActionPanel: BottomActionPanelStyles;
  connectionStatusBar: ConnectionStatusBarStyles;
  controlledSeatBanner: ControlledSeatBannerStyles;
  hostGuideBanner: HostGuideBannerStyles;
  progressIndicator: RoomProgressIndicatorStyles;
  statusRibbon: StatusRibbonStyles;
} {
  return {
    bottomActionPanel: StyleSheet.create<BottomActionPanelStyles>({
      container: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 0,
        borderTopRightRadius: 0,
        paddingTop: spacing.medium + spacing.tight,
        paddingHorizontal: spacing.medium,
        paddingBottom: spacing.medium,
        borderTopWidth: fixed.borderWidth,
        borderTopColor: colors.border,
        overflow: 'hidden',
        ...shadows.lgUpward,
      },
      dockContainer: {
        paddingTop: spacing.small,
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
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: spacing.small,
      },
      compactManagementStack: {
        gap: spacing.small,
      },
      ghostRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.medium,
        paddingTop: spacing.tight,
      },
      dockRow: {
        minHeight: componentSizes.button.lg,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.small,
      },
      dockCenter: {
        flex: 1,
        minWidth: 0,
        alignItems: 'stretch',
      },
      dockPrimary: {
        alignSelf: 'stretch',
      },
      toolSlot: {
        width: componentSizes.menu.compactMinWidth,
        minHeight: componentSizes.button.lg,
      },
      infoRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: spacing.small,
      },
      infoAction: {
        flex: 1,
        minWidth: 0,
      },
      hostManagementEntry: {
        width: '100%',
        minHeight: componentSizes.button.md,
        paddingHorizontal: spacing.small,
        borderRadius: borderRadius.small,
      },
      hostManagementContent: {
        width: '100%',
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: spacing.small,
      },
      hostManagementTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.tight,
      },
      hostManagementTitle: {
        ...textStyles.secondarySemibold,
        color: colors.text,
      },
      hostManagementPreviewRow: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: spacing.tight,
      },
      hostManagementPreview: {
        ...textStyles.caption,
        color: colors.textSecondary,
        flexShrink: 1,
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
      failedRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.small,
      },
      reconnectButton: {
        paddingHorizontal: spacing.small,
        paddingVertical: spacing.tight,
        borderRadius: borderRadius.small,
        backgroundColor: withAlpha(colors.error, 0.2),
      },
      reconnectText: {
        fontSize: typography.secondary,
        lineHeight: typography.lineHeights.secondary,
        color: colors.error,
        fontWeight: typography.weights.semibold,
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
        backgroundColor: withAlpha(colors.info, 0.08),
        paddingVertical: spacing.small,
        paddingHorizontal: spacing.medium,
        marginHorizontal: spacing.medium,
        marginTop: spacing.small,
        borderRadius: borderRadius.large,
        ...shadows.sm,
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

    progressIndicator: StyleSheet.create<RoomProgressIndicatorStyles>({
      container: {
        paddingHorizontal: spacing.medium,
        paddingVertical: spacing.small,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.large,
        marginHorizontal: spacing.medium,
        marginTop: spacing.small,
        ...shadows.sm,
      },
      headerRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: spacing.tight,
      },
      stepText: {
        ...textStyles.secondarySemibold,
        color: colors.text,
      },
      labelText: {
        fontSize: typography.secondary,
        lineHeight: typography.lineHeights.secondary,
        color: colors.textSecondary,
      },
      progressBarContainer: {
        height: spacing.small,
        backgroundColor: withAlpha(colors.primary, 0.1),
        borderRadius: borderRadius.full,
        overflow: 'hidden',
      },
      progressBarFill: {
        height: '100%',
        backgroundColor: colors.primary,
        borderRadius: borderRadius.full,
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
