/**
 * TemplatePicker styles — board template card, faction badges, role chips, search.
 *
 * Separated from ConfigScreenStyles to keep the template picker self-contained.
 * Created once per theme change, passed to BoardTemplateCard and child components.
 */
import type { TextStyle, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

import {
  borderRadius,
  componentSizes,
  fixed,
  layout,
  shadows,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
  withAlpha,
} from '@/theme';

export interface TemplatePickerStyles {
  // ── Modal shell ──
  pickerOverlay: ViewStyle;
  pickerContent: ViewStyle;
  pickerHandle: ViewStyle;
  pickerHeader: ViewStyle;
  pickerTitle: TextStyle;
  pickerCloseBtn: ViewStyle;
  pickerCloseBtnText: TextStyle;
  // ── Search ──
  searchContainer: ViewStyle;
  searchInput: TextStyle;
  searchClearBtn: ViewStyle;
  // ── Section header ──
  sectionHeader: ViewStyle;
  sectionHeaderText: TextStyle;
  // ── Template card ──
  templateCard: ViewStyle;
  templateCardSelected: ViewStyle;
  templateCardHeader: ViewStyle;
  templateCardTitleRow: ViewStyle;
  templateCardTitle: TextStyle;
  templateCardPlayerBadge: ViewStyle;
  templateCardPlayerText: TextStyle;
  templateCardChevron: TextStyle;
  templateCardExpanded: ViewStyle;
  templateCardDivider: ViewStyle;
  // ── Faction stat badges ──
  factionStatRow: ViewStyle;
  factionStatBadge: ViewStyle;
  factionStatText: TextStyle;
  // ── Key role chips (collapsed preview) ──
  keyRoleRow: ViewStyle;
  keyRoleChip: ViewStyle;
  keyRoleChipText: TextStyle;
  keyRoleMore: TextStyle;
  // ── Role list by faction (expanded) ──
  roleListContainer: ViewStyle;
  factionRow: ViewStyle;
  factionRowLabel: TextStyle;
  factionChipWrap: ViewStyle;
  roleListHint: TextStyle;
  // ── Empty state ──
  emptyContainer: ViewStyle;
  emptyText: TextStyle;
  emptyClearBtn: ViewStyle;
  emptyClearBtnText: TextStyle;
  // ── Search icon ──
  searchIcon: TextStyle;
  // ── SectionList content ──
  sectionListContent: ViewStyle;
  sectionListContentWithBar: ViewStyle;
  // ── Confirmation bar ──
  confirmationBar: ViewStyle;
  confirmationText: TextStyle;
  confirmationBtn: ViewStyle;
  confirmationBtnText: TextStyle;
}

export const createTemplatePickerStyles = (colors: ThemeColors): TemplatePickerStyles =>
  StyleSheet.create<TemplatePickerStyles>({
    // ── Modal shell ───────────────────────────────
    pickerOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    pickerContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: borderRadius.large,
      borderTopRightRadius: borderRadius.large,
      maxHeight: '80%',
      paddingBottom: spacing.xlarge,
    },
    pickerHandle: {
      width: componentSizes.button.sm + spacing.tight,
      height: spacing.tight,
      borderRadius: spacing.micro,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginVertical: spacing.small + spacing.micro,
    },
    pickerHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: layout.screenPaddingH,
      paddingBottom: spacing.small,
    },
    pickerTitle: {
      ...textStyles.subtitleSemibold,
      color: colors.text,
    },
    pickerCloseBtn: {
      padding: spacing.small,
    },
    pickerCloseBtnText: {
      color: colors.textSecondary,
    },

    // ── Search ────────────────────────────────────
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: layout.screenPaddingH,
      marginBottom: spacing.small,
      paddingHorizontal: spacing.small + spacing.tight,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.medium,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      height: componentSizes.button.sm + spacing.tight,
    },
    searchInput: {
      flex: 1,
      fontSize: typography.body,
      lineHeight: typography.lineHeights.body,
      color: colors.text,
      paddingVertical: 0,
    },
    searchClearBtn: {
      padding: spacing.tight,
    },

    // ── Section header ────────────────────────────
    sectionHeader: {
      paddingHorizontal: layout.screenPaddingH,
      paddingTop: spacing.medium,
      paddingBottom: spacing.small,
    },
    sectionHeaderText: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: typography.letterSpacing.wide,
    },

    // ── Template card ─────────────────────────────
    templateCard: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      marginHorizontal: layout.screenPaddingH,
      marginBottom: spacing.small,
      ...shadows.sm,
      overflow: 'hidden',
    },
    templateCardSelected: {
      borderLeftWidth: fixed.borderWidthHighlight,
      borderLeftColor: colors.primary,
    },
    templateCardHeader: {
      padding: spacing.medium,
    },
    templateCardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.small,
    },
    templateCardTitle: {
      flex: 1,
      ...textStyles.bodySemibold,
      color: colors.text,
    },
    templateCardPlayerBadge: {
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.micro,
      borderRadius: borderRadius.full,
      backgroundColor: withAlpha(colors.primary, 0.1),
      marginLeft: spacing.small,
    },
    templateCardPlayerText: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      fontWeight: typography.weights.medium,
      color: colors.primary,
    },
    templateCardChevron: {
      marginLeft: spacing.small,
    },
    templateCardExpanded: {
      paddingHorizontal: spacing.medium,
      paddingBottom: spacing.medium,
    },
    templateCardDivider: {
      height: fixed.divider,
      backgroundColor: colors.border,
      marginBottom: spacing.medium,
    },
    templateCardCTA: {
      alignItems: 'center',
      justifyContent: 'center',
      height: componentSizes.button.sm + spacing.tight,
      borderRadius: borderRadius.medium,
      borderWidth: fixed.borderWidth,
      borderColor: colors.primary,
      marginTop: spacing.medium,
    },
    templateCardCTASelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    templateCardCTAText: {
      ...textStyles.secondarySemibold,
      color: colors.primary,
    },
    templateCardCTATextSelected: {
      color: colors.textInverse,
    },

    // ── Faction stat badges ───────────────────────
    factionStatRow: {
      flexDirection: 'row',
      gap: spacing.small,
      marginBottom: spacing.small,
    },
    factionStatBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.micro,
      borderRadius: borderRadius.full,
    },
    factionStatText: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      fontWeight: typography.weights.semibold,
    },

    // ── Key role chips ────────────────────────────
    keyRoleRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.tight,
      alignItems: 'center',
    },
    keyRoleChip: {
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.micro,
      borderRadius: borderRadius.full,
      borderWidth: fixed.borderWidth,
    },
    keyRoleChipText: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      fontWeight: typography.weights.medium,
    },
    keyRoleMore: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.textSecondary,
      fontWeight: typography.weights.medium,
    },

    // ── Role list by faction (expanded) ───────────
    roleListContainer: {
      gap: spacing.small,
    },
    factionRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.small,
    },
    factionRowLabel: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.secondary,
      fontWeight: typography.weights.medium,
      color: colors.textSecondary,
      width: 56,
      flexShrink: 0,
    },
    factionChipWrap: {
      flex: 1,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.tight,
    },
    roleListHint: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.small,
    },

    // ── Empty state ───────────────────────────────
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxlarge,
    },
    emptyText: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.textSecondary,
    },
    emptyClearBtn: {
      marginTop: spacing.medium,
    },
    emptyClearBtnText: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.primary,
    },

    // ── Search icon ───────────────────────────────
    searchIcon: {
      marginRight: spacing.small,
    },

    // ── SectionList content ───────────────────────
    sectionListContent: {
      paddingBottom: layout.screenPaddingH,
    },
    sectionListContentWithBar: {
      paddingBottom: 60,
    },

    // ── Confirmation bar ──────────────────────────
    confirmationBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: layout.screenPaddingH,
      paddingVertical: spacing.small + spacing.tight,
      backgroundColor: colors.surface,
      borderTopWidth: fixed.borderWidth,
      borderTopColor: colors.border,
    },
    confirmationText: {
      flex: 1,
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.text,
      fontWeight: typography.weights.medium,
    },
    confirmationBtn: {
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.primary,
    },
    confirmationBtnText: {
      ...textStyles.secondarySemibold,
      color: colors.textInverse,
    },
  });
