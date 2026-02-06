/**
 * ConfigScreen shared styles
 *
 * Created once in parent, passed to all sub-components to avoid redundant StyleSheet.create calls.
 *
 * Layout: Tab-based faction switching (方案 A)
 */
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import {
  spacing,
  borderRadius,
  typography,
  ThemeColors,
  shadows,
  layout,
} from '../../../theme';
import { componentSizes, fixed } from '../../../theme/tokens';

export interface ConfigScreenStyles {
  container: ViewStyle;
  // Header row 1 (back + 配置 title + gear)
  header: ViewStyle;
  headerBtn: ViewStyle;
  headerBtnText: TextStyle;
  headerCenter: ViewStyle;
  headerTitle: TextStyle;
  headerGearBtn: ViewStyle;
  headerGearBtnText: TextStyle;
  // Card A (template + faction tabs)
  cardA: ViewStyle;
  cardADivider: ViewStyle;
  // Header row 2 (template pill + player count, inside cardA)
  templateRow: ViewStyle;
  templatePill: ViewStyle;
  templatePillText: TextStyle;
  templatePillArrow: TextStyle;
  playerCount: TextStyle;
  // Bottom create button
  bottomCreateBar: ViewStyle;
  bottomCreateBtn: ViewStyle;
  bottomCreateBtnDisabled: ViewStyle;
  bottomCreateBtnText: TextStyle;
  // Faction tab bar (inside cardA)
  tabBar: ViewStyle;
  tab: ViewStyle;
  tabActive: ViewStyle;
  tabLabel: TextStyle;
  tabBadge: ViewStyle;
  tabBadgeText: TextStyle;
  tabIndicator: ViewStyle;
  // Card B (stepper + role sections)
  cardB: ViewStyle;
  cardBDivider: ViewStyle;
  // Settings row (used by Dropdown)
  settingsRow: ViewStyle;
  settingsItem: ViewStyle;
  settingsLabel: TextStyle;
  settingsSelector: ViewStyle;
  settingsSelectorText: TextStyle;
  settingsSelectorArrow: TextStyle;
  // Settings sheet (Animation + BGM)
  settingsSheetOverlay: ViewStyle;
  settingsSheetContent: ViewStyle;
  settingsSheetHandle: ViewStyle;
  settingsSheetTitle: TextStyle;
  // Section (within tab content) — iOS Grouped Card
  section: ViewStyle;
  sectionTitle: TextStyle;
  sectionCard: ViewStyle;
  chipContainer: ViewStyle;
  // Role chip
  chip: ViewStyle;
  chipSelected: ViewStyle;
  chipSelectedWolf: ViewStyle;
  chipSelectedGood: ViewStyle;
  chipSelectedNeutral: ViewStyle;
  chipText: TextStyle;
  chipTextSelected: TextStyle;
  // Role stepper
  stepperRow: ViewStyle;
  stepperLabel: TextStyle;
  stepperPill: ViewStyle;
  stepperControls: ViewStyle;
  stepperBtn: ViewStyle;
  stepperBtnDisabled: ViewStyle;
  stepperBtnText: TextStyle;
  stepperBtnTextDisabled: TextStyle;
  stepperCount: TextStyle;
  // Scroll area
  scrollView: ViewStyle;
  // Loading
  loadingContainer: ViewStyle;
  loadingText: TextStyle;
  // Modal styles (for Dropdown)
  modalOverlay: ViewStyle;
  modalContent: ViewStyle;
  modalHeader: ViewStyle;
  modalTitle: TextStyle;
  modalCloseBtn: ViewStyle;
  modalCloseBtnText: TextStyle;
  modalOption: ViewStyle;
  modalOptionSelected: ViewStyle;
  modalOptionText: TextStyle;
  modalOptionTextSelected: TextStyle;
  modalOptionCheck: TextStyle;
}

export const createConfigScreenStyles = (colors: ThemeColors): ConfigScreenStyles =>
  StyleSheet.create<ConfigScreenStyles>({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },

    // ── Header row 1: ← | 配置 | ⚙️ ────────────
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: layout.screenPaddingH,
      paddingVertical: spacing.small + spacing.tight,
      backgroundColor: colors.surface,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
    },
    headerBtn: {
      width: componentSizes.avatar.md,
      height: componentSizes.avatar.md,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerBtnText: {
      fontSize: typography.title,
      color: colors.text,
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: typography.subtitle,
      fontWeight: typography.weights.bold,
      color: colors.text,
    },
    headerGearBtn: {
      width: componentSizes.avatar.md,
      height: componentSizes.avatar.md,
      borderRadius: borderRadius.medium,
      backgroundColor: colors.background,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerGearBtnText: {
      fontSize: typography.body,
    },

    // ── Card A: template + faction tabs (merged card) ──
    cardA: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      marginHorizontal: layout.screenPaddingH,
      marginTop: spacing.small,
      overflow: 'hidden',
      ...shadows.sm,
    },
    cardADivider: {
      height: fixed.divider,
      backgroundColor: colors.border,
      marginHorizontal: layout.cardPadding,
    },

    // ── Template row (inside cardA, no own card styling) ──
    templateRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.small + spacing.tight,
      gap: spacing.small,
    },
    templatePill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: borderRadius.full,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      paddingHorizontal: componentSizes.chip.paddingH,
      paddingVertical: componentSizes.chip.paddingV,
    },
    templatePillText: {
      fontSize: typography.secondary,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    templatePillArrow: {
      fontSize: typography.caption,
      color: colors.textSecondary,
      marginLeft: spacing.tight,
    },
    playerCount: {
      fontSize: typography.secondary,
      color: colors.textSecondary,
      fontWeight: typography.weights.medium,
    },

    // ── Bottom create button ────────────────────
    bottomCreateBar: {
      paddingHorizontal: layout.screenPaddingH,
      paddingVertical: spacing.small + spacing.tight,
      backgroundColor: colors.background,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.border,
    },
    bottomCreateBtn: {
      height: componentSizes.button.lg,
      borderRadius: borderRadius.full,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    bottomCreateBtnDisabled: {
      opacity: 0.5,
    },
    bottomCreateBtnText: {
      color: colors.textInverse,
      fontSize: typography.body,
      fontWeight: typography.weights.semibold,
    },

    // ── Settings row ────────────────────────────
    settingsRow: {
      flexDirection: 'row',
      paddingHorizontal: layout.screenPaddingH,
      paddingVertical: spacing.small,
      backgroundColor: colors.surface,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
      gap: spacing.medium,
    },
    settingsItem: {
      flex: 1,
    },
    settingsLabel: {
      fontSize: typography.caption,
      color: colors.textSecondary,
      marginBottom: spacing.tight,
    },
    settingsSelector: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.small,
      backgroundColor: colors.background,
      borderRadius: borderRadius.medium,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
    },
    settingsSelectorText: {
      fontSize: typography.secondary,
      color: colors.text,
      flex: 1,
    },
    settingsSelectorArrow: {
      fontSize: typography.secondary,
      color: colors.textSecondary,
      marginLeft: spacing.tight,
    },

    // ── Faction tab bar (inside cardA, no own card styling) ──
    tabBar: {
      flexDirection: 'row',
      paddingTop: spacing.tight,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.small + spacing.tight,
      position: 'relative' as const,
    },
    tabActive: {},
    tabLabel: {
      fontSize: typography.secondary,
      fontWeight: typography.weights.semibold,
      color: colors.textMuted,
      marginBottom: spacing.tight,
    },
    tabBadge: {
      paddingHorizontal: spacing.small + spacing.tight,
      paddingVertical: spacing.tight / 2,
      borderRadius: borderRadius.full,
    },
    tabBadgeText: {
      fontSize: typography.body,
      fontWeight: typography.weights.bold,
      color: colors.textSecondary,
    },
    tabIndicator: {
      position: 'absolute' as const,
      bottom: 0,
      left: spacing.medium,
      right: spacing.medium,
      height: fixed.borderWidthThick + 0.5,
      borderRadius: fixed.borderWidth,
    },

    // ── Settings sheet (Animation + BGM) ──────
    settingsSheetOverlay: {
      flex: 1,
      backgroundColor: colors.overlayLight,
      justifyContent: 'flex-end',
    },
    settingsSheetContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: borderRadius.large,
      borderTopRightRadius: borderRadius.large,
      paddingHorizontal: layout.screenPaddingH,
      paddingBottom: spacing.xlarge,
    },
    settingsSheetHandle: {
      width: componentSizes.button.sm + spacing.tight,
      height: spacing.tight,
      borderRadius: spacing.tight / 2,
      backgroundColor: colors.border,
      alignSelf: 'center',
      marginVertical: spacing.small + spacing.tight / 2,
    },
    settingsSheetTitle: {
      fontSize: typography.subtitle,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      marginBottom: spacing.medium,
    },

    // ── Section (inside cardB) ────────────
    section: {
      marginTop: spacing.medium,
    },
    sectionTitle: {
      fontSize: typography.body,
      fontWeight: typography.weights.semibold,
      color: colors.text,
      marginBottom: spacing.small,
      paddingHorizontal: layout.cardPadding,
    },
    sectionCard: {
      paddingHorizontal: layout.cardPadding,
      paddingVertical: spacing.small + spacing.tight,
    },
    chipContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.small,
    },

    // ── Role chip (inside card) ────────────────
    chip: {
      width: '30%',
      paddingVertical: componentSizes.chip.paddingV,
      backgroundColor: colors.background,
      borderRadius: borderRadius.full,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipSelected: {
      backgroundColor: colors.primary + '20',
      borderColor: colors.primary,
    },
    chipSelectedWolf: {
      backgroundColor: colors.wolf + '20',
      borderColor: colors.wolf,
    },
    chipSelectedGood: {
      backgroundColor: colors.god + '20',
      borderColor: colors.god,
    },
    chipSelectedNeutral: {
      backgroundColor: colors.warning + '20',
      borderColor: colors.warning,
    },
    chipText: {
      fontSize: typography.secondary,
      fontWeight: typography.weights.medium,
      color: colors.textSecondary,
    },
    chipTextSelected: {
      fontWeight: typography.weights.semibold,
    },

    // ── Card B: stepper + role sections (merged card) ──
    cardB: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      marginHorizontal: layout.screenPaddingH,
      marginTop: spacing.small,
      paddingBottom: spacing.small + spacing.tight,
      ...shadows.sm,
    },
    cardBDivider: {
      height: fixed.divider,
      backgroundColor: colors.border,
      marginHorizontal: layout.cardPadding,
    },

    // ── Role stepper (inside cardB, no own card styling) ──
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.small + spacing.tight,
      paddingHorizontal: layout.cardPadding,
    },
    stepperLabel: {
      fontSize: typography.body,
      color: colors.text,
      fontWeight: typography.weights.semibold,
    },
    stepperPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: borderRadius.full,
      borderWidth: fixed.borderWidth,
      borderColor: colors.border,
      paddingHorizontal: spacing.tight / 2,
      paddingVertical: spacing.tight / 2,
    },
    stepperControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 0,
    },
    stepperBtn: {
      width: spacing.large + spacing.tight,
      height: spacing.large + spacing.tight,
      borderRadius: borderRadius.full,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepperBtnDisabled: {
      opacity: 0.25,
    },
    stepperBtnText: {
      fontSize: typography.subtitle,
      fontWeight: typography.weights.semibold,
    },
    stepperBtnTextDisabled: {
      color: colors.textMuted,
    },
    stepperCount: {
      fontSize: typography.body,
      fontWeight: typography.weights.bold,
      color: colors.text,
      minWidth: spacing.large,
      textAlign: 'center',
    },

    // ── Scroll area ─────────────────────────────
    scrollView: {
      flex: 1,
    },

    // ── Loading ─────────────────────────────────
    loadingContainer: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
    loadingText: {
      marginTop: spacing.medium,
      fontSize: typography.body,
      color: colors.textSecondary,
    },

    // ── Modal (Dropdown) ────────────────────────
    modalOverlay: {
      flex: 1,
      backgroundColor: colors.overlay,
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: borderRadius.large,
      borderTopRightRadius: borderRadius.large,
      paddingBottom: spacing.xlarge,
      maxHeight: '60%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: layout.screenPaddingH,
      paddingVertical: spacing.medium,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: typography.subtitle,
      fontWeight: typography.weights.semibold,
      color: colors.text,
    },
    modalCloseBtn: {
      padding: spacing.small,
    },
    modalCloseBtnText: {
      fontSize: typography.title,
      color: colors.textSecondary,
    },
    modalOption: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: layout.screenPaddingH,
      paddingVertical: spacing.medium,
      borderBottomWidth: fixed.borderWidth,
      borderBottomColor: colors.border,
    },
    modalOptionSelected: {
      backgroundColor: colors.primaryLight + '20',
    },
    modalOptionText: {
      fontSize: typography.body,
      color: colors.text,
    },
    modalOptionTextSelected: {
      color: colors.primary,
      fontWeight: typography.weights.semibold,
    },
    modalOptionCheck: {
      fontSize: typography.body,
      color: colors.primary,
    },
  });
