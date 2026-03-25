/**
 * Notepad panel styles.
 *
 * Full-screen notepad modal chrome, per-seat cards with role badges,
 * hand-raise tags, role-assignment popover, legend bar and public note area.
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

export function createNotepadStyles(colors: ThemeColors) {
  const styles = StyleSheet.create({
    // ── Notepad (full-screen modal) ──────────────────
    notepadModal: {
      flex: 1,
      backgroundColor: colors.background,
    },
    notepadHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
    },
    notepadHeaderTitle: {
      fontSize: typography.subtitle,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    notepadHeaderButtons: {
      flexDirection: 'row',
      gap: spacing.small,
    },
    notepadHeaderBtn: {
      padding: spacing.tight,
    },
    notepadHeaderBtnText: {
      fontSize: typography.body,
      color: colors.textSecondary,
    },
    notepadContainer: {
      flex: 1,
    },
    notepadList: {
      flex: 1,
    },
    notepadListContent: {
      padding: spacing.tight,
      gap: spacing.tight,
    },
    notepadCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      ...shadows.sm,
      paddingHorizontal: spacing.tight,
      paddingVertical: spacing.tight,
      gap: spacing.tight,
    },
    notepadCardWolf: {
      backgroundColor: withAlpha(colors.wolf, 0.094),
    },
    notepadCardGod: {
      backgroundColor: withAlpha(colors.god, 0.094),
    },
    notepadCardVillager: {
      backgroundColor: withAlpha(colors.villager, 0.094),
    },
    notepadCardThird: {
      backgroundColor: withAlpha(colors.third, 0.094),
    },
    notepadCardHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.tight,
    },
    notepadSeatBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.micro,
      minHeight: componentSizes.button.sm,
    },
    notepadSeatNumber: {
      fontSize: typography.secondary,
      fontWeight: typography.weights.bold,
      color: colors.text,
      minWidth: componentSizes.icon.lg,
      textAlign: 'center',
    },
    notepadSeatPlaceholder: {
      fontSize: typography.caption,
      color: colors.textSecondary,
    },
    notepadRoleBadge: {
      minWidth: componentSizes.badge.md,
      paddingHorizontal: spacing.micro,
      paddingVertical: 1,
      borderRadius: borderRadius.small,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notepadRoleBadgeEmpty: {
      backgroundColor: withAlpha(colors.primary, 0.06),
      borderWidth: 1,
      borderStyle: 'dashed' as const,
      borderColor: colors.textSecondary,
    },
    notepadRoleBadgeWolf: {
      backgroundColor: withAlpha(colors.wolf, 0.188),
    },
    notepadRoleBadgeGod: {
      backgroundColor: withAlpha(colors.god, 0.188),
    },
    notepadRoleBadgeVillager: {
      backgroundColor: withAlpha(colors.villager, 0.188),
    },
    notepadRoleBadgeThird: {
      backgroundColor: withAlpha(colors.third, 0.188),
    },
    notepadRoleBadgeText: {
      fontSize: typography.caption,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    notepadRoleBadgeTextWolf: {
      color: colors.wolf,
    },
    notepadRoleBadgeTextGod: {
      color: colors.god,
    },
    notepadRoleBadgeTextVillager: {
      color: colors.villager,
    },
    notepadRoleBadgeTextThird: {
      color: colors.third,
    },
    notepadHandTag: {
      marginLeft: 'auto',
      minHeight: componentSizes.button.sm,
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.tight,
      borderRadius: borderRadius.small,
      backgroundColor: colors.background,
      justifyContent: 'center',
    },
    notepadHandTagActive: {
      backgroundColor: withAlpha(colors.primary, 0.188),
    },
    notepadHandTagText: {
      fontSize: typography.caption,
      color: colors.textMuted,
    },
    notepadHandTagTextActive: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    notepadPopoverOverlay: {
      ...StyleSheet.absoluteFillObject,
      backgroundColor: colors.overlayLight,
      justifyContent: 'center',
      alignItems: 'center',
    },
    notepadPopover: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      padding: spacing.medium,
      ...shadows.lg,
      width: 280,
    },
    notepadPopoverTitle: {
      fontSize: typography.secondary,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      marginBottom: spacing.small,
      textAlign: 'center',
    },
    notepadPopoverGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.small,
      justifyContent: 'center',
    },
    notepadPopoverTag: {
      minWidth: componentSizes.button.md,
      minHeight: componentSizes.button.md,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notepadPopoverTagSelectedWolf: {
      backgroundColor: withAlpha(colors.wolf, 0.188),
    },
    notepadPopoverTagSelectedGod: {
      backgroundColor: withAlpha(colors.god, 0.188),
    },
    notepadPopoverTagSelectedVillager: {
      backgroundColor: withAlpha(colors.villager, 0.188),
    },
    notepadPopoverTagSelectedThird: {
      backgroundColor: withAlpha(colors.third, 0.188),
    },
    notepadPopoverTagText: {
      fontSize: typography.body,
      color: colors.textMuted,
    },
    notepadPopoverTagTextWolf: {
      color: colors.wolf,
    },
    notepadPopoverTagTextGod: {
      color: colors.god,
    },
    notepadPopoverTagTextVillager: {
      color: colors.villager,
    },
    notepadPopoverTagTextThird: {
      color: colors.third,
    },
    notepadPopoverTagTextSelected: {
      color: colors.text,
      fontWeight: typography.weights.bold,
    },
    notepadPopoverClearBtn: {
      minWidth: componentSizes.button.md,
      minHeight: componentSizes.button.md,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.background,
      alignItems: 'center',
      justifyContent: 'center',
    },
    notepadPopoverClearText: {
      fontSize: typography.body,
      color: colors.error,
    },
    notepadNoteInput: {
      flex: 1,
      backgroundColor: colors.background,
      borderRadius: borderRadius.small,
      paddingHorizontal: spacing.small,
      paddingVertical: 0,
      fontSize: typography.body, // ≥ 16px — prevents iOS Safari auto-zoom
      color: colors.text,
    },
    notepadLegend: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: spacing.medium,
      paddingVertical: spacing.small,
      borderTopWidth: fixed.borderWidth,
      borderTopColor: colors.border,
    },
    notepadLegendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.tight,
    },
    notepadLegendDot: {
      width: spacing.small,
      height: spacing.small,
      borderRadius: borderRadius.full,
    },
    notepadLegendDotWolf: {
      backgroundColor: colors.wolf,
    },
    notepadLegendDotGod: {
      backgroundColor: colors.god,
    },
    notepadLegendDotVillager: {
      backgroundColor: colors.villager,
    },
    notepadLegendDotThird: {
      backgroundColor: colors.third,
    },
    notepadLegendText: {
      fontSize: typography.caption,
      color: colors.textSecondary,
    },

    // ── Notepad public note section ────────────────
    notepadPublicSection: {
      paddingHorizontal: spacing.medium,
      paddingTop: spacing.small,
      paddingBottom: spacing.tight,
      borderTopWidth: fixed.borderWidth,
      borderTopColor: colors.border,
    },
    notepadPublicLabel: {
      fontSize: typography.secondary,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      marginBottom: spacing.tight,
    },
    notepadPublicRow: {
      flexDirection: 'row',
      gap: spacing.small,
    },
    notepadPublicInput: {
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
  });

  return {
    ...styles,
    /** Non-style token: placeholder color for TextInputs */
    notepadPlaceholderColor: colors.textMuted,
  };
}
