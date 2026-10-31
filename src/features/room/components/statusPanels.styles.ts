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
  RoomProgressIndicatorStyles,
} from './styles';

export function createStatusPanelStyles(colors: ThemeColors): {
  bottomActionPanel: BottomActionPanelStyles;
  connectionStatusBar: ConnectionStatusBarStyles;
  controlledSeatBanner: ControlledSeatBannerStyles;
  progressIndicator: RoomProgressIndicatorStyles;
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
      compactContainer: {
        paddingTop: spacing.small,
        paddingBottom: spacing.small,
      },
      dockContainer: {
        paddingTop: spacing.small,
      },
      progressRow: {
        marginBottom: spacing.small,
      },
      progressRowCompact: {
        marginBottom: spacing.tight,
      },
      message: {
        textAlign: 'center',
        fontSize: typography.body,
        lineHeight: typography.lineHeights.body,
        color: colors.text,
        marginBottom: spacing.small,
        paddingHorizontal: spacing.small,
      },
      messageCompact: {
        marginBottom: spacing.tight,
      },
      stepsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: spacing.small,
        marginBottom: spacing.small,
        paddingHorizontal: spacing.small,
      },
      stepItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.tight,
      },
      stepLabelComplete: {
        ...textStyles.secondarySemibold,
        color: colors.textSecondary,
      },
      stepLabelCurrent: {
        ...textStyles.secondarySemibold,
        color: colors.primary,
      },
      stepLabelUpcoming: {
        ...textStyles.secondarySemibold,
        color: colors.textMuted,
      },
      stepSeparator: {
        ...textStyles.caption,
        color: colors.textMuted,
      },
      hint: {
        ...textStyles.caption,
        textAlign: 'center',
        color: colors.textSecondary,
        marginBottom: spacing.small,
        paddingHorizontal: spacing.small,
      },
      buttonRow: {
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: spacing.small,
      },
      secondaryRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'stretch',
        gap: spacing.small,
      },
      secondaryButton: {
        flex: 1,
        flexBasis: '45%',
        minWidth: 0,
      },
      actionButton: {
        minHeight: fixed.minTouchTarget,
        minWidth: fixed.minTouchTarget,
      },
      secondaryAction: {
        backgroundColor: colors.surfaceHover,
      },
      hostManagementBlock: {
        gap: spacing.small,
        paddingTop: spacing.small,
        borderTopWidth: fixed.borderWidth,
        borderTopColor: colors.borderLight,
      },
      compactManagementStack: {
        gap: spacing.small,
      },
      ghostRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: spacing.medium,
        paddingTop: spacing.tight,
      },
      dockPrimary: {
        alignSelf: 'stretch',
      },
      dockToolRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
        gap: spacing.small,
      },
      dockExpandedToolSlot: {
        flex: 1,
        minWidth: 0,
        minHeight: fixed.minTouchTarget,
      },
      hostManagementEntry: {
        width: '100%',
        minHeight: componentSizes.button.md,
        paddingHorizontal: spacing.medium,
        backgroundColor: colors.surfaceHover,
        borderColor: colors.border,
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
        color: colors.textSecondary,
      },
      hostManagementExpandRow: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: spacing.tight,
      },
      hostManagementExpandLabel: {
        ...textStyles.caption,
        color: colors.textSecondary,
        flexShrink: 1,
      },
      nextStepReady: {
        width: '100%',
        minHeight: componentSizes.button.md,
        paddingHorizontal: spacing.medium,
      },
      nextStepBlocked: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: spacing.small,
        paddingHorizontal: spacing.small,
        paddingVertical: spacing.small,
        borderRadius: borderRadius.small,
        borderWidth: fixed.borderWidth,
        borderColor: colors.border,
        backgroundColor: colors.background,
      },
      nextStepBlockedText: {
        flex: 1,
        minWidth: 0,
        gap: spacing.micro,
      },
      nextStepBlockedLabel: {
        ...textStyles.secondarySemibold,
        color: colors.text,
      },
      nextStepBlockedReason: {
        ...textStyles.caption,
        color: colors.textSecondary,
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
        width: 'auto',
        height: componentSizes.progressBar.height,
        borderRadius: 0,
        backgroundColor: 'transparent',
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
        marginTop: spacing.small,
        marginBottom: spacing.small,
        borderRadius: borderRadius.large,
        ...shadows.sm,
      },
      text: {
        ...textStyles.secondarySemibold,
        color: colors.text,
        flex: 1,
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

    progressIndicator: StyleSheet.create<RoomProgressIndicatorStyles>({
      container: {
        paddingHorizontal: spacing.medium,
        paddingVertical: spacing.small,
        backgroundColor: colors.surface,
        borderRadius: borderRadius.large,
        ...shadows.sm,
      },
      compactContainer: {
        paddingVertical: spacing.tight,
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
  };
}
