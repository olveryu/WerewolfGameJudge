/** Theme-based styles for the sheriff-election room panel. */

import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import { createSharedStyles, type ThemeColors, withAlpha } from '@/theme';
import {
  borderRadius,
  componentSizes,
  fixed,
  shadows,
  spacing,
  textStyles,
  typography,
} from '@/theme/tokens';

const BALLOT_CHOICE_FOUR_COLUMN_BASIS = '22%' as const;

export interface SheriffElectionPanelStyles {
  hud: ViewStyle;
  hudPressed: ViewStyle;
  hudTopRow: ViewStyle;
  hudTitleGroup: ViewStyle;
  hudTitle: TextStyle;
  hudPhaseBadge: ViewStyle;
  hudPhaseBadgeText: TextStyle;
  hudSummaryRow: ViewStyle;
  hudSummary: TextStyle;
  hudDetails: ViewStyle;
  hudDetailsText: TextStyle;
  sheetOverlay: ViewStyle;
  sheet: ViewStyle;
  sheetHandle: ViewStyle;
  sheetCloseRow: ViewStyle;
  sheetScroll: ViewStyle;
  sheetScrollContent: ViewStyle;
  inspector: ViewStyle;
  inspectorScroll: ViewStyle;
  inspectorScrollContent: ViewStyle;
  container: ViewStyle;
  headerRow: ViewStyle;
  titleGroup: ViewStyle;
  title: TextStyle;
  phaseBadge: ViewStyle;
  phaseBadgeText: TextStyle;
  description: TextStyle;
  records: ViewStyle;
  recordRow: ViewStyle;
  recordLabel: TextStyle;
  recordValue: TextStyle;
  recordValueColumn: ViewStyle;
  recordEmpty: TextStyle;
  seatDotRow: ViewStyle;
  seatDot: ViewStyle;
  seatDotText: TextStyle;
  seatDotWithdrawn: ViewStyle;
  seatDotTextWithdrawn: TextStyle;
  seatDotSmall: ViewStyle;
  seatDotSmallText: TextStyle;
  withdrawnNote: TextStyle;
  resultBanner: ViewStyle;
  resultBannerNeutral: ViewStyle;
  resultMedal: ViewStyle;
  resultMedalNeutral: ViewStyle;
  resultTextGroup: ViewStyle;
  resultTitle: TextStyle;
  resultSubtitle: TextStyle;
  divider: ViewStyle;
  voteStatusRow: ViewStyle;
  voteProgress: TextStyle;
  ballotStatus: TextStyle;
  candidateSection: ViewStyle;
  sectionTitle: TextStyle;
  candidateGrid: ViewStyle;
  ballotChoice: ViewStyle;
  ballotChoiceSelected: ViewStyle;
  ballotChoicePressed: ViewStyle;
  ballotChoiceDisabled: ViewStyle;
  ballotChoiceIndicator: ViewStyle;
  ballotChoiceText: TextStyle;
  ballotChoiceTextSelected: TextStyle;
  roundSection: ViewStyle;
  roundTitle: TextStyle;
  tallyCard: ViewStyle;
  tallyGroup: ViewStyle;
  tallyGroupBorder: ViewStyle;
  tallyRow: ViewStyle;
  tallyName: TextStyle;
  tallyNameWinner: TextStyle;
  tallyBarTrack: ViewStyle;
  tallyBarFill: ViewStyle;
  tallyBarFillWinner: ViewStyle;
  tallyCount: TextStyle;
  voterChips: ViewStyle;
  voterChip: ViewStyle;
  abstainRow: ViewStyle;
  abstainLabel: TextStyle;
  emptyBallots: TextStyle;
}

export function createSheriffElectionPanelStyles(colors: ThemeColors): SheriffElectionPanelStyles {
  const shared = createSharedStyles(colors);
  return StyleSheet.create<SheriffElectionPanelStyles>({
    hud: {
      minHeight: componentSizes.button.lg,
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      borderWidth: fixed.borderWidth,
      borderColor: withAlpha(colors.primary, 0.28),
      borderRadius: borderRadius.medium,
      backgroundColor: colors.surface,
      ...shadows.sm,
    },
    hudPressed: {
      backgroundColor: colors.surfaceHover,
    },
    hudTopRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.small,
    },
    hudTitleGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
      minWidth: 0,
      flex: 1,
    },
    hudTitle: {
      ...textStyles.secondarySemibold,
      color: colors.text,
    },
    hudPhaseBadge: {
      flexShrink: 1,
      borderRadius: borderRadius.small,
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.micro,
      backgroundColor: withAlpha(colors.primary, 0.12),
    },
    hudPhaseBadgeText: {
      ...textStyles.caption,
      fontWeight: typography.weights.semibold,
      color: colors.primary,
    },
    hudSummaryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
      marginTop: spacing.tight,
    },
    hudSummary: {
      ...textStyles.caption,
      color: colors.textSecondary,
      flex: 1,
    },
    hudDetails: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.micro,
    },
    hudDetailsText: {
      ...textStyles.caption,
      fontWeight: typography.weights.semibold,
      color: colors.primary,
    },
    sheetOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
      backgroundColor: colors.overlay,
    },
    sheet: {
      ...shared.sheetBase,
      maxHeight: '85%',
      backgroundColor: colors.surface,
      ...shadows.lg,
    },
    sheetHandle: {
      ...shared.sheetHandle,
    },
    sheetCloseRow: {
      alignItems: 'flex-end',
      paddingHorizontal: spacing.medium,
    },
    sheetScroll: {
      flexShrink: 1,
    },
    sheetScrollContent: {
      paddingBottom: spacing.xlarge,
    },
    inspector: {
      flex: 1,
      minHeight: 0,
      backgroundColor: colors.surface,
    },
    inspectorScroll: {
      flex: 1,
    },
    inspectorScrollContent: {
      paddingBottom: spacing.xlarge,
    },
    container: {
      padding: spacing.large,
      backgroundColor: colors.surface,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.small,
    },
    titleGroup: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
      flexShrink: 1,
    },
    title: {
      ...textStyles.subtitleSemibold,
      color: colors.text,
    },
    phaseBadge: {
      flexShrink: 1,
      borderRadius: borderRadius.small,
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.micro,
      backgroundColor: withAlpha(colors.primary, 0.12),
    },
    phaseBadgeText: {
      ...textStyles.caption,
      fontWeight: typography.weights.semibold,
      color: colors.primary,
    },
    description: {
      ...textStyles.secondary,
      color: colors.textSecondary,
      marginTop: spacing.small,
    },
    records: {
      marginTop: spacing.medium,
      gap: spacing.small,
    },
    recordRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.small,
    },
    recordLabel: {
      ...textStyles.secondarySemibold,
      color: colors.textSecondary,
      width: componentSizes.avatar.md,
    },
    recordValue: {
      ...textStyles.secondary,
      color: colors.text,
      flex: 1,
    },
    recordValueColumn: {
      flex: 1,
    },
    recordEmpty: {
      ...textStyles.secondary,
      color: colors.textSecondary,
    },
    seatDotRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.tight,
    },
    seatDot: {
      width: componentSizes.avatar.xs,
      height: componentSizes.avatar.xs,
      borderRadius: borderRadius.full,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    seatDotText: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    seatDotWithdrawn: {
      opacity: fixed.disabledOpacity,
    },
    seatDotTextWithdrawn: {
      textDecorationLine: 'line-through',
    },
    seatDotSmall: {
      width: componentSizes.badge.md,
      height: componentSizes.badge.md,
    },
    seatDotSmallText: {
      ...textStyles.captionSmall,
    },
    withdrawnNote: {
      ...textStyles.caption,
      color: colors.textSecondary,
      marginTop: spacing.tight,
    },
    resultBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
      padding: spacing.medium,
      borderRadius: borderRadius.medium,
      backgroundColor: withAlpha(colors.warning, 0.12),
      marginTop: spacing.medium,
    },
    resultBannerNeutral: {
      backgroundColor: colors.background,
    },
    resultMedal: {
      width: componentSizes.avatar.md,
      height: componentSizes.avatar.md,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.warning,
      alignItems: 'center',
      justifyContent: 'center',
      flexShrink: 0,
    },
    resultMedalNeutral: {
      backgroundColor: colors.surfaceHover,
    },
    resultTextGroup: {
      flex: 1,
    },
    resultTitle: {
      ...textStyles.bodySemibold,
      color: colors.text,
    },
    resultSubtitle: {
      ...textStyles.caption,
      color: colors.textSecondary,
      marginTop: spacing.micro,
    },
    divider: {
      height: fixed.borderWidth,
      backgroundColor: colors.border,
      marginVertical: spacing.medium,
    },
    voteStatusRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.small,
    },
    voteProgress: {
      ...textStyles.caption,
      color: colors.primary,
    },
    ballotStatus: {
      ...textStyles.caption,
      color: colors.textSecondary,
    },
    candidateSection: {
      marginTop: spacing.medium,
      gap: spacing.small,
    },
    sectionTitle: {
      ...textStyles.secondarySemibold,
      color: colors.text,
    },
    candidateGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.small,
    },
    ballotChoice: {
      position: 'relative',
      flexBasis: BALLOT_CHOICE_FOUR_COLUMN_BASIS,
      flexGrow: 1,
      maxWidth: componentSizes.avatar.xl,
      minHeight: componentSizes.button.md,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.small,
      borderRadius: borderRadius.small,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    ballotChoiceSelected: {
      borderWidth: fixed.borderWidthHighlight,
      borderColor: colors.primary,
      backgroundColor: withAlpha(colors.primary, 0.12),
    },
    ballotChoicePressed: {
      backgroundColor: colors.surfaceHover,
    },
    ballotChoiceDisabled: {
      opacity: fixed.disabledOpacity,
    },
    ballotChoiceIndicator: {
      position: 'absolute',
      top: spacing.tight,
      right: spacing.tight,
      width: componentSizes.icon.sm,
      height: componentSizes.icon.sm,
      alignItems: 'center',
      justifyContent: 'center',
    },
    ballotChoiceText: {
      ...textStyles.bodySemibold,
      color: colors.text,
    },
    ballotChoiceTextSelected: {
      color: colors.primary,
    },
    roundSection: {
      gap: spacing.small,
      marginBottom: spacing.medium,
    },
    roundTitle: {
      ...textStyles.secondarySemibold,
      color: colors.text,
    },
    tallyCard: {
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      borderRadius: borderRadius.medium,
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.tight,
    },
    tallyGroup: {
      paddingVertical: spacing.small,
    },
    tallyGroupBorder: {
      borderTopWidth: fixed.borderWidth,
      borderTopColor: colors.borderLight,
    },
    tallyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
    },
    tallyName: {
      ...textStyles.secondarySemibold,
      color: colors.text,
      width: componentSizes.avatar.md,
      flexShrink: 0,
    },
    tallyNameWinner: {
      color: colors.warning,
    },
    tallyBarTrack: {
      flex: 1,
      flexDirection: 'row',
      height: componentSizes.badge.dot,
      borderRadius: borderRadius.full,
      backgroundColor: colors.background,
      overflow: 'hidden',
    },
    tallyBarFill: {
      height: '100%',
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
    },
    tallyBarFillWinner: {
      backgroundColor: colors.warning,
    },
    tallyCount: {
      ...textStyles.secondarySemibold,
      color: colors.text,
      width: componentSizes.avatar.md,
      flexShrink: 0,
      textAlign: 'right',
    },
    voterChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.tight,
      marginTop: spacing.tight,
      marginLeft: componentSizes.avatar.md + spacing.small,
    },
    voterChip: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.micro,
      paddingHorizontal: spacing.micro,
      borderWidth: fixed.borderWidth,
      borderColor: colors.borderLight,
      borderRadius: borderRadius.full,
      backgroundColor: colors.surface,
    },
    abstainRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      alignItems: 'center',
      gap: spacing.tight,
      marginTop: spacing.small,
    },
    abstainLabel: {
      ...textStyles.caption,
      color: colors.textSecondary,
    },
    emptyBallots: {
      ...textStyles.caption,
      color: colors.textSecondary,
    },
  });
}
