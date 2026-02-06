/**
 * ConfigScreen shared styles
 *
 * Created once in parent, passed to all sub-components to avoid redundant StyleSheet.create calls.
 *
 * Layout: Tab-based faction switching (方案 A)
 */
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { spacing, borderRadius, typography, ThemeColors } from '../../../theme';

export interface ConfigScreenStyles {
  container: ViewStyle;
  // Header (back + title + create button)
  header: ViewStyle;
  headerBtn: ViewStyle;
  headerBtnText: TextStyle;
  headerCenter: ViewStyle;
  title: TextStyle;
  subtitle: TextStyle;
  headerCreateBtn: ViewStyle;
  headerCreateBtnDisabled: ViewStyle;
  headerCreateBtnText: TextStyle;
  // Faction tab bar
  tabBar: ViewStyle;
  tab: ViewStyle;
  tabActive: ViewStyle;
  tabLabel: TextStyle;
  tabBadge: ViewStyle;
  tabBadgeText: TextStyle;
  tabIndicator: ViewStyle;
  // Settings row (used by Dropdown inside BottomActionBar)
  settingsRow: ViewStyle;
  settingsItem: ViewStyle;
  settingsLabel: TextStyle;
  settingsSelector: ViewStyle;
  settingsSelectorText: TextStyle;
  settingsSelectorArrow: TextStyle;
  // Bottom action bar (Template + Animation + BGM)
  bottomBar: ViewStyle;
  // Section (within tab content)
  section: ViewStyle;
  sectionTitle: TextStyle;
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

    // ── Header ──────────────────────────────────
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.medium,
      paddingBottom: spacing.small,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerBtn: {
      width: spacing.xlarge + spacing.small,
      height: spacing.xlarge + spacing.small,
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
      justifyContent: 'center',
    },
    title: {
      fontSize: typography.subtitle,
      fontWeight: '600',
      color: colors.text,
    },
    subtitle: {
      fontSize: typography.secondary,
      color: colors.textSecondary,
      marginTop: spacing.tight / 2,
    },
    headerCreateBtn: {
      width: spacing.xlarge + spacing.large + spacing.tight, // 60
      height: spacing.xlarge + spacing.small, // 40
      borderRadius: borderRadius.medium,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerCreateBtnDisabled: {
      opacity: 0.5,
    },
    headerCreateBtnText: {
      color: colors.textInverse,
      fontSize: typography.secondary,
      fontWeight: '600',
    },

    // ── Settings row ────────────────────────────
    settingsRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
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
      borderWidth: 1,
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

    // ── Faction tab bar ─────────────────────────
    tabBar: {
      flexDirection: 'row',
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    tab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.small + spacing.tight / 2,
      position: 'relative' as const,
    },
    tabActive: {
      // active background is subtle — indicator line provides main highlight
    },
    tabLabel: {
      fontSize: typography.caption,
      fontWeight: '600',
      color: colors.textMuted,
      marginBottom: spacing.tight / 2,
    },
    tabBadge: {
      paddingHorizontal: spacing.small,
      paddingVertical: 1,
      borderRadius: borderRadius.full,
    },
    tabBadgeText: {
      fontSize: typography.caption,
      fontWeight: '700',
      color: colors.textMuted,
    },
    tabIndicator: {
      position: 'absolute' as const,
      bottom: 0,
      left: spacing.medium,
      right: spacing.medium,
      height: 2.5,
      borderRadius: 2,
    },

    // ── Bottom action bar ───────────────────────
    bottomBar: {
      flexDirection: 'row',
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small,
      backgroundColor: colors.surface,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: spacing.medium,
    },

    // ── Section (within tab content) ────────────
    section: {
      marginBottom: spacing.medium,
    },
    sectionTitle: {
      fontSize: typography.caption,
      fontWeight: '400',
      color: colors.textMuted,
      marginBottom: spacing.tight,
      letterSpacing: 0.5,
    },
    chipContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.small,
    },

    // ── Role chip ───────────────────────────────
    chip: {
      width: '30%',
      paddingVertical: spacing.small,
      backgroundColor: colors.background,
      borderRadius: borderRadius.full,
      borderWidth: 1.5,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    chipSelected: {
      backgroundColor: colors.primary + '15',
      borderColor: colors.primary,
    },
    chipSelectedWolf: {
      backgroundColor: colors.wolf + '15',
      borderColor: colors.wolf,
    },
    chipSelectedGood: {
      backgroundColor: colors.god + '15',
      borderColor: colors.god,
    },
    chipSelectedNeutral: {
      backgroundColor: colors.warning + '15',
      borderColor: colors.warning,
    },
    chipText: {
      fontSize: typography.caption,
      color: colors.textSecondary,
    },
    chipTextSelected: {
      fontWeight: '600',
    },

    // ── Role stepper ────────────────────────────
    stepperRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: spacing.tight,
      paddingHorizontal: spacing.tight,
    },
    stepperLabel: {
      fontSize: typography.secondary,
      color: colors.text,
      fontWeight: '600',
    },
    stepperPill: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.background,
      borderRadius: borderRadius.full,
      borderWidth: 1,
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
      fontWeight: '600',
    },
    stepperBtnTextDisabled: {
      color: colors.textMuted,
    },
    stepperCount: {
      fontSize: typography.body,
      fontWeight: '700',
      color: colors.text,
      minWidth: spacing.large,
      textAlign: 'center',
    },

    // ── Scroll area ─────────────────────────────
    scrollView: {
      flex: 1,
      padding: spacing.medium,
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
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.medium,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: typography.subtitle,
      fontWeight: '600',
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
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.medium,
      borderBottomWidth: 1,
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
      fontWeight: '600',
    },
    modalOptionCheck: {
      fontSize: typography.body,
      color: colors.primary,
    },
  });
