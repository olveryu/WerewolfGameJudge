/**
 * NotepadScreen styles.
 *
 * Screen-level chrome (header, public note section, legend) and
 * per-seat card styles consumed by NotepadPanel via NotepadStyles prop.
 */
import { StyleSheet } from 'react-native';

import {
  borderRadius,
  componentSizes,
  fixed,
  shadows,
  spacing,
  type ThemeColors,
  typography,
  withAlpha,
} from '@/theme';

export function createNotepadScreenStyles(colors: ThemeColors) {
  const styles = StyleSheet.create({
    // ── Screen chrome ────────────────────────────────
    screen: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
    },
    headerTitle: {
      fontSize: typography.subtitle,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    headerButtons: {
      flexDirection: 'row',
      gap: spacing.small,
    },
    headerBtn: {
      padding: spacing.tight,
    },
    headerBtnText: {
      fontSize: typography.body,
      color: colors.textSecondary,
    },
    aiAnalysisBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.micro,
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.micro,
      borderRadius: borderRadius.medium,
      borderWidth: fixed.borderWidth,
      borderColor: colors.primary,
    },
    aiAnalysisBtnText: {
      fontSize: typography.secondary,
      fontWeight: typography.weights.medium,
      color: colors.primary,
    },

    // ── Public note section ──────────────────────────
    publicSection: {
      paddingHorizontal: spacing.medium,
      paddingTop: spacing.small,
      paddingBottom: spacing.tight,
      borderTopWidth: fixed.borderWidth,
      borderTopColor: colors.border,
    },
    publicLabel: {
      fontSize: typography.secondary,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      marginBottom: spacing.tight,
    },
    publicRow: {
      flexDirection: 'row',
      gap: spacing.small,
    },
    publicInput: {
      flex: 1,
      backgroundColor: colors.background,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      borderRadius: borderRadius.medium,
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.small,
      fontSize: typography.body,
      color: colors.text,
      minHeight: 80,
      maxHeight: 160,
    },

    // ── NotepadPanel styles (passed as NotepadStyles prop) ──
    container: {
      flex: 1,
    },
    list: {
      flex: 1,
    },
    listContent: {
      padding: spacing.tight,
      gap: spacing.tight,
    },
    card: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      ...shadows.sm,
      paddingHorizontal: spacing.tight,
      paddingVertical: spacing.tight,
      gap: spacing.tight,
    },
    cardWolf: {
      backgroundColor: withAlpha(colors.wolf, 0.094),
    },
    cardGod: {
      backgroundColor: withAlpha(colors.god, 0.094),
    },
    cardVillager: {
      backgroundColor: withAlpha(colors.villager, 0.094),
    },
    cardThird: {
      backgroundColor: withAlpha(colors.third, 0.094),
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.tight,
    },
    seatBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.micro,
      minHeight: componentSizes.button.sm,
    },
    seatNumber: {
      fontSize: typography.secondary,
      fontWeight: typography.weights.bold,
      color: colors.text,
      minWidth: componentSizes.icon.lg,
      textAlign: 'center',
    },
    seatPlaceholder: {
      fontSize: typography.caption,
      color: colors.textSecondary,
    },
    roleBadge: {
      minWidth: componentSizes.badge.md,
      paddingHorizontal: spacing.micro,
      paddingVertical: 1,
      borderRadius: borderRadius.small,
      alignItems: 'center',
      justifyContent: 'center',
    },
    roleBadgeEmpty: {
      backgroundColor: withAlpha(colors.primary, 0.06),
      borderWidth: 1,
      borderStyle: 'dashed' as const,
      borderColor: colors.textSecondary,
    },
    roleBadgeWolf: {
      backgroundColor: withAlpha(colors.wolf, 0.188),
    },
    roleBadgeGod: {
      backgroundColor: withAlpha(colors.god, 0.188),
    },
    roleBadgeVillager: {
      backgroundColor: withAlpha(colors.villager, 0.188),
    },
    roleBadgeThird: {
      backgroundColor: withAlpha(colors.third, 0.188),
    },
    roleBadgeText: {
      fontSize: typography.caption,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    roleBadgeTextWolf: {
      color: colors.wolf,
    },
    roleBadgeTextGod: {
      color: colors.god,
    },
    roleBadgeTextVillager: {
      color: colors.villager,
    },
    roleBadgeTextThird: {
      color: colors.third,
    },
    handTag: {
      marginLeft: 'auto',
      minHeight: componentSizes.button.sm,
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.tight,
      borderRadius: borderRadius.small,
      backgroundColor: colors.background,
      justifyContent: 'center',
    },
    handTagActive: {
      backgroundColor: withAlpha(colors.primary, 0.188),
    },
    handTagText: {
      fontSize: typography.caption,
      color: colors.textMuted,
    },
    handTagTextActive: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    popoverOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlayLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    popover: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      padding: spacing.medium,
      ...shadows.lg,
      width: 280,
    },
    popoverTitle: {
      fontSize: typography.secondary,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      marginBottom: spacing.small,
      textAlign: 'center',
    },
    popoverGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.small,
      justifyContent: 'center',
    },
    popoverTag: {
      minWidth: componentSizes.button.md,
      minHeight: componentSizes.button.md,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    popoverTagSelectedWolf: {
      backgroundColor: withAlpha(colors.wolf, 0.188),
    },
    popoverTagSelectedGod: {
      backgroundColor: withAlpha(colors.god, 0.188),
    },
    popoverTagSelectedVillager: {
      backgroundColor: withAlpha(colors.villager, 0.188),
    },
    popoverTagSelectedThird: {
      backgroundColor: withAlpha(colors.third, 0.188),
    },
    popoverTagText: {
      fontSize: typography.body,
      color: colors.textMuted,
    },
    popoverTagTextWolf: {
      color: colors.wolf,
    },
    popoverTagTextGod: {
      color: colors.god,
    },
    popoverTagTextVillager: {
      color: colors.villager,
    },
    popoverTagTextThird: {
      color: colors.third,
    },
    popoverTagTextSelected: {
      color: colors.text,
      fontWeight: typography.weights.bold,
    },
    popoverClearBtn: {
      minWidth: componentSizes.button.md,
      minHeight: componentSizes.button.md,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    popoverClearText: {
      fontSize: typography.body,
      color: colors.error,
    },
    noteInput: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: borderRadius.small,
      paddingHorizontal: spacing.small,
      paddingVertical: 0,
      fontSize: typography.body, // ≥ 16px — prevents iOS Safari auto-zoom
      color: colors.text,
    },
    legend: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.medium,
      paddingVertical: spacing.small,
      borderTopWidth: fixed.borderWidth,
      borderTopColor: colors.border,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.tight,
    },
    legendDot: {
      width: spacing.small,
      height: spacing.small,
      borderRadius: borderRadius.full,
    },
    legendDotWolf: {
      backgroundColor: colors.wolf,
    },
    legendDotGod: {
      backgroundColor: colors.god,
    },
    legendDotVillager: {
      backgroundColor: colors.villager,
    },
    legendDotThird: {
      backgroundColor: colors.third,
    },
    legendText: {
      fontSize: typography.caption,
      color: colors.textSecondary,
    },
  });

  return {
    ...styles,
    /** Non-style token: placeholder color for TextInputs */
    placeholderColor: colors.textMuted,
  };
}
