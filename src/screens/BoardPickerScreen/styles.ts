/**
 * BoardPickerScreen styles — full-screen board template browser.
 *
 * Created once per theme change, passed to all child components.
 * Uses theme tokens exclusively; no hardcoded style values.
 */
import type { TextStyle, ViewStyle } from 'react-native';
import { StyleSheet } from 'react-native';

import {
  borderRadius,
  createSharedStyles,
  fixed,
  layout,
  shadows,
  spacing,
  textStyles,
  type ThemeColors,
  typography,
  withAlpha,
} from '@/theme';

export interface BoardPickerStyles {
  // ── Layout ──
  container: ViewStyle;
  header: ViewStyle;
  headerBackButton: ViewStyle;
  headerCenter: ViewStyle;
  headerTitle: TextStyle;
  headerSubtitleRow: ViewStyle;
  headerSubtitle: TextStyle;
  headerRight: ViewStyle;
  // ── Search ──
  searchBar: ViewStyle;
  searchInput: TextStyle;
  // ── Category Tabs ──
  tabBar: ViewStyle;
  tab: ViewStyle;
  tabActive: ViewStyle;
  tabText: TextStyle;
  tabTextActive: TextStyle;
  // ── Role Filter Modal ──
  filterOverlay: ViewStyle;
  filterModal: ViewStyle;
  filterTitle: TextStyle;
  filterSectionHeader: ViewStyle;
  filterSectionLabel: TextStyle;
  filterSectionCount: TextStyle;
  filterChipWrap: ViewStyle;
  filterItem: ViewStyle;
  filterItemActive: ViewStyle;
  filterItemText: TextStyle;
  filterItemTextActive: TextStyle;
  filterFooter: ViewStyle;
  filterHint: TextStyle;
  filterBadge: ViewStyle;
  filterBadgeText: TextStyle;
  // ── SectionList ──
  listStyle: ViewStyle;
  listContent: ViewStyle;
  sectionHeader: ViewStyle;
  sectionAccent: ViewStyle;
  sectionTitle: TextStyle;
  // ── Card ──
  card: ViewStyle;
  cardSelected: ViewStyle;
  cardHeader: ViewStyle;
  cardTitleRow: ViewStyle;
  cardTitle: TextStyle;
  cardPlayerBadge: ViewStyle;
  cardPlayerText: TextStyle;
  cardChevron: TextStyle;
  cardExpanded: ViewStyle;
  cardDivider: ViewStyle;
  // ── Faction stat badges ──
  factionStatRow: ViewStyle;
  factionStatBadge: ViewStyle;
  factionStatText: TextStyle;
  // ── Key role chips ──
  keyRoleRow: ViewStyle;
  keyRoleChip: ViewStyle;
  keyRoleChipText: TextStyle;
  keyRoleMore: TextStyle;
  // ── Role list hint (expanded) ──
  roleListHint: TextStyle;
  // ── Empty state ──
  emptyContainer: ViewStyle;
  emptyText: TextStyle;
  // ── Bottom bar ──
  bottomBar: ViewStyle;
  customButtonRow: ViewStyle;
  customButtonText: TextStyle;
}

export const createBoardPickerStyles = (colors: ThemeColors): BoardPickerStyles => {
  const shared = createSharedStyles(colors);

  return StyleSheet.create<BoardPickerStyles>({
    // ── Layout ────────────────────────────────────
    container: shared.screenContainer,
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.screenH,
      paddingVertical: layout.headerPaddingV,
      backgroundColor: colors.surface,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
    },
    headerBackButton: {
      zIndex: 1,
    },
    headerCenter: {
      ...StyleSheet.absoluteFillObject,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: layout.headerTitleSize,
      lineHeight: layout.headerTitleLineHeight,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    headerSubtitleRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.tight,
      paddingBottom: spacing.small,
    },
    headerSubtitle: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.textSecondary,
    },
    headerRight: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small,
      zIndex: 1,
    },

    // ── Search ────────────────────────────────────
    searchBar: {
      flexDirection: 'row',
      alignItems: 'center',
      marginHorizontal: spacing.screenH,
      marginTop: spacing.small,
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      backgroundColor: colors.surface,
      borderRadius: borderRadius.full,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      gap: spacing.small,
    },
    searchInput: {
      flex: 1,
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      color: colors.text,
      padding: 0,
    },

    // ── Category Tabs ─────────────────────────────
    tabBar: {
      flexDirection: 'row',
      paddingHorizontal: spacing.screenH,
      marginTop: spacing.small,
      marginBottom: spacing.small,
      gap: spacing.small,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.small,
      borderRadius: borderRadius.small,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      backgroundColor: colors.surface,
    },
    tabActive: {
      backgroundColor: withAlpha(colors.primary, 0.15),
      borderColor: colors.primary,
    },
    tabText: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      fontWeight: typography.weights.medium,
      color: colors.text,
    },
    tabTextActive: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },

    // ── Role Filter Modal ──────────────────────
    filterOverlay: {
      flex: 1,
      backgroundColor: withAlpha(colors.background, 0.5),
      justifyContent: 'center',
      alignItems: 'center',
    },
    filterModal: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      paddingVertical: spacing.medium,
      paddingHorizontal: spacing.large,
      minWidth: 260,
      maxWidth: '85%',
      maxHeight: '80%',
      ...shadows.md,
    },
    filterTitle: {
      fontSize: typography.secondary,
      lineHeight: typography.lineHeights.secondary,
      fontWeight: typography.weights.bold,
      color: colors.text,
      marginBottom: spacing.medium,
    },
    filterSectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: spacing.small,
      marginTop: spacing.tight,
    },
    filterSectionLabel: {
      fontSize: typography.body,
      lineHeight: typography.lineHeights.body,
      fontWeight: typography.weights.semibold,
      color: colors.textSecondary,
    },
    filterSectionCount: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      fontWeight: typography.weights.medium,
      color: colors.textMuted,
      marginLeft: spacing.tight,
    },
    filterChipWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.tight,
    },
    filterItem: {
      paddingHorizontal: spacing.small + spacing.tight,
      paddingVertical: spacing.micro + spacing.tight,
      borderRadius: borderRadius.full,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      backgroundColor: colors.background,
    },
    filterItemActive: {
      borderColor: colors.primary,
      backgroundColor: withAlpha(colors.primary, 0.12),
    },
    filterItemText: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      fontWeight: typography.weights.medium,
      color: colors.textSecondary,
    },
    filterItemTextActive: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    filterFooter: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: spacing.medium,
      gap: spacing.medium,
    },
    filterHint: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.textMuted,
      textAlign: 'center',
      marginTop: spacing.small,
    },
    filterBadge: {
      position: 'absolute',
      top: -spacing.tight,
      right: -spacing.tight,
      minWidth: spacing.medium + spacing.tight,
      height: spacing.medium + spacing.tight,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.micro,
    },
    filterBadgeText: {
      fontSize: typography.captionSmall,
      lineHeight: typography.lineHeights.captionSmall,
      fontWeight: typography.weights.bold,
      color: colors.textInverse,
    },

    // ── SectionList ───────────────────────────────
    listStyle: {
      flex: 1,
      backgroundColor: colors.transparent,
    },
    listContent: {
      paddingBottom: spacing.xxlarge + spacing.xlarge,
    },
    sectionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: layout.screenPaddingH,
      paddingTop: spacing.large,
      paddingBottom: spacing.small,
    },
    sectionAccent: {
      width: spacing.tight,
      height: typography.secondary,
      borderRadius: borderRadius.full,
      marginRight: spacing.small,
    },
    sectionTitle: {
      ...textStyles.secondarySemibold,
      color: colors.textSecondary,
    },

    // ── Card ──────────────────────────────────────
    card: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      marginHorizontal: layout.screenPaddingH,
      marginBottom: spacing.small,
      ...shadows.sm,
      overflow: 'hidden',
    },
    cardSelected: {
      borderLeftWidth: fixed.borderWidthHighlight,
      borderLeftColor: colors.primary,
    },
    cardHeader: {
      padding: spacing.medium,
    },
    cardTitleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: spacing.small,
    },
    cardTitle: {
      flex: 1,
      ...textStyles.bodySemibold,
      color: colors.text,
    },
    cardPlayerBadge: {
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.micro,
      borderRadius: borderRadius.full,
      backgroundColor: withAlpha(colors.primary, 0.1),
      marginLeft: spacing.small,
    },
    cardPlayerText: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      fontWeight: typography.weights.medium,
      color: colors.primary,
    },
    cardChevron: {
      marginLeft: spacing.small,
    },
    cardExpanded: {
      paddingHorizontal: spacing.medium,
      paddingBottom: spacing.medium,
    },
    cardDivider: {
      height: fixed.divider,
      backgroundColor: colors.border,
      marginBottom: spacing.medium,
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

    // ── Role list hint (expanded) ─────────────
    roleListHint: {
      fontSize: typography.caption,
      lineHeight: typography.lineHeights.caption,
      color: colors.textMuted,
      textAlign: 'center',
    },

    // ── Empty state ───────────────────────────────
    emptyContainer: {
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.xxlarge,
      gap: spacing.medium,
    },
    emptyText: {
      ...textStyles.body,
      color: colors.textSecondary,
    },

    // ── Bottom bar ────────────────────────────────
    bottomBar: {
      paddingHorizontal: layout.screenPaddingH,
      paddingVertical: spacing.medium,
      backgroundColor: colors.surface,
      ...shadows.upward,
    },
    customButtonRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.small,
    },
    customButtonText: {
      ...textStyles.secondarySemibold,
      color: colors.primary,
    },
  });
};
