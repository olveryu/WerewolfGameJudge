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
  tallyList: ViewStyle;
  tallyRow: ViewStyle;
  tallySeat: TextStyle;
  tallyValue: TextStyle;
  ballotListTitle: TextStyle;
  ballotList: ViewStyle;
  ballotRow: ViewStyle;
  ballotSeat: TextStyle;
  ballotArrow: TextStyle;
  ballotTarget: TextStyle;
  emptyBallots: TextStyle;
  finalBanner: ViewStyle;
  finalText: TextStyle;
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
    tallyList: {
      borderTopWidth: fixed.borderWidth,
      borderTopColor: colors.border,
    },
    tallyRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: componentSizes.button.sm,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
    },
    tallySeat: {
      ...textStyles.secondarySemibold,
      color: colors.text,
    },
    tallyValue: {
      ...textStyles.secondary,
      color: colors.primary,
    },
    ballotListTitle: {
      ...textStyles.caption,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
      marginTop: spacing.tight,
    },
    ballotList: {
      gap: spacing.tight,
    },
    ballotRow: {
      flexDirection: 'row',
      alignItems: 'center',
      minHeight: componentSizes.icon.lg,
    },
    ballotSeat: {
      ...textStyles.caption,
      color: colors.text,
      width: componentSizes.avatar.lg,
    },
    ballotArrow: {
      ...textStyles.caption,
      color: colors.textMuted,
      width: componentSizes.icon.lg,
      textAlign: 'center',
    },
    ballotTarget: {
      ...textStyles.caption,
      color: colors.text,
      flex: 1,
    },
    emptyBallots: {
      ...textStyles.caption,
      color: colors.textSecondary,
    },
    finalBanner: {
      padding: spacing.medium,
      borderRadius: borderRadius.small,
      backgroundColor: withAlpha(colors.success, 0.12),
    },
    finalText: {
      ...textStyles.bodySemibold,
      color: colors.success,
      textAlign: 'center',
    },
  });
}
