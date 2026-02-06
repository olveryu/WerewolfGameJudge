/**
 * ConfigScreen shared styles
 *
 * Created once in parent, passed to all sub-components to avoid redundant StyleSheet.create calls.
 *
 * Layout: Compact collapsible panels (方案 A)
 */
import { StyleSheet, ViewStyle, TextStyle } from 'react-native';
import { spacing, borderRadius, typography, shadows, ThemeColors } from '../../../theme';

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
  // Settings row (Template + Animation + BGM)
  settingsRow: ViewStyle;
  settingsItem: ViewStyle;
  settingsLabel: TextStyle;
  settingsSelector: ViewStyle;
  settingsSelectorText: TextStyle;
  settingsSelectorArrow: TextStyle;
  // Collapsible faction panel
  factionPanel: ViewStyle;
  factionHeader: ViewStyle;
  factionHeaderLeft: ViewStyle;
  factionChevron: TextStyle;
  factionTitle: TextStyle;
  factionBadge: ViewStyle;
  factionBadgeText: TextStyle;
  factionContent: ViewStyle;
  // Section (within faction panel)
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

    // ── Collapsible faction panel ───────────────
    factionPanel: {
      backgroundColor: colors.surface,
      borderRadius: borderRadius.large,
      marginBottom: spacing.small,
      ...shadows.sm,
      overflow: 'hidden',
    },
    factionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.medium,
      paddingVertical: spacing.small + spacing.tight / 2,
    },
    factionHeaderLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.tight,
    },
    factionChevron: {
      fontSize: typography.body,
      color: colors.textMuted,
      width: spacing.medium,
    },
    factionTitle: {
      fontSize: typography.body,
      fontWeight: '700',
    },
    factionBadge: {
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.tight / 2,
      borderRadius: borderRadius.full,
    },
    factionBadgeText: {
      fontSize: typography.caption,
      fontWeight: '600',
    },
    factionContent: {
      paddingHorizontal: spacing.medium,
      paddingBottom: spacing.small,
    },

    // ── Section (within faction panel) ──────────
    section: {
      marginBottom: spacing.small,
    },
    sectionTitle: {
      fontSize: 11,
      fontWeight: '400',
      color: colors.textMuted,
      marginBottom: spacing.tight,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
    },
    chipContainer: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.tight,
    },

    // ── Role chip ───────────────────────────────
    chip: {
      minWidth: spacing.xxlarge + spacing.large,
      paddingHorizontal: spacing.small,
      paddingVertical: spacing.tight,
      backgroundColor: colors.background,
      borderRadius: borderRadius.full,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
    },
    chipSelected: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    chipSelectedWolf: {
      backgroundColor: colors.wolf,
      borderColor: colors.wolf,
    },
    chipSelectedGood: {
      backgroundColor: colors.god,
      borderColor: colors.god,
    },
    chipSelectedNeutral: {
      backgroundColor: colors.warning,
      borderColor: colors.warning,
    },
    chipText: {
      fontSize: typography.caption,
      color: colors.textSecondary,
    },
    chipTextSelected: {
      color: colors.textInverse,
      fontWeight: '500',
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
    stepperControls: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.small + spacing.tight,
    },
    stepperBtn: {
      width: spacing.xlarge + spacing.tight,
      height: spacing.xlarge + spacing.tight,
      borderRadius: borderRadius.full,
      backgroundColor: colors.background,
      borderWidth: 1.5,
      borderColor: colors.border,
      justifyContent: 'center',
      alignItems: 'center',
    },
    stepperBtnDisabled: {
      opacity: 0.25,
    },
    stepperBtnText: {
      fontSize: typography.title,
      fontWeight: '600',
    },
    stepperBtnTextDisabled: {
      color: colors.textMuted,
    },
    stepperCount: {
      fontSize: typography.title,
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
