/**
 * ConfigScreen shared styles — barrel file.
 *
 * Composes per-group style creators into a single ConfigScreenStyles object.
 * Created once in parent, passed to all sub-components.
 */
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import type { ThemeColors } from '@/theme';

import { createConfigLayoutStyles } from './configLayout.styles';
import { createDropdownStyles } from './dropdown.styles';
import { createFactionTabsStyles } from './factionTabs.styles';
import { createRoleSelectorStyles } from './roleSelector.styles';
import { createSheetStyles } from './sheet.styles';

export interface ConfigScreenStyles {
  container: ViewStyle;
  // Header row (back + template pill · count + ⋯)
  header: ViewStyle;
  headerBtn: ViewStyle;
  headerBtnText: TextStyle;
  headerCenter: ViewStyle;
  headerTitle: TextStyle;
  // Overflow (⋯) menu
  overflowMenuOverlay: ViewStyle;
  overflowMenu: ViewStyle;
  overflowMenuItem: ViewStyle;
  overflowMenuItemIcon: TextStyle;
  overflowMenuItemText: TextStyle;
  // Card A (faction tabs)
  cardA: ViewStyle;
  cardADivider: ViewStyle;
  // Header row 2 (template pill + player count, inside cardA)
  templateRow: ViewStyle;
  templatePill: ViewStyle;
  templatePillText: TextStyle;
  templatePillArrow: TextStyle;
  playerCount: TextStyle;
  clearBtn: ViewStyle;
  clearBtnText: TextStyle;
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
  tabLabelActive: TextStyle;
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
  chipSelectedGod: ViewStyle;
  chipSelectedVillager: ViewStyle;
  chipSelectedNeutral: ViewStyle;
  chipText: TextStyle;
  chipTextSelected: TextStyle;
  chipVariant: ViewStyle;
  cardBFooterHint: TextStyle;

  // Variant picker modal
  variantPickerOverlay: ViewStyle;
  variantPickerContent: ViewStyle;
  variantPickerHandle: ViewStyle;
  variantPickerTitle: TextStyle;
  variantPickerOption: ViewStyle;
  variantPickerOptionSelected: ViewStyle;
  variantPickerRadio: ViewStyle;
  variantPickerRadioSelected: ViewStyle;
  variantPickerRadioDot: ViewStyle;
  variantPickerOptionContent: ViewStyle;
  variantPickerOptionName: TextStyle;
  variantPickerOptionDesc: TextStyle;
  // Role info sheet
  roleInfoDesc: TextStyle;
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
  scrollContent: ViewStyle;
  // Loading
  loadingContainer: ViewStyle;
  loadingText: TextStyle;
  // Settings chip group (SettingsSheet / TemplatePicker)
  settingsChipGroup: ViewStyle;
  settingsChipGroupLabel: TextStyle;
  settingsChipWrap: ViewStyle;
  settingsChip: ViewStyle;
  settingsChipSelected: ViewStyle;
  settingsChipText: TextStyle;
  settingsChipTextSelected: TextStyle;
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
    ...createConfigLayoutStyles(colors),
    ...createFactionTabsStyles(colors),
    ...createRoleSelectorStyles(colors),
    ...createDropdownStyles(colors),
    ...createSheetStyles(colors),
  });
