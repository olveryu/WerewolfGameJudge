/**
 * ConfigScreen shared styles — barrel file.
 *
 * Composes per-group style creators into a single ConfigScreenStyles object.
 * Created once in parent, passed to all sub-components.
 */
import { StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

import type { ThemeColors } from '@/theme';

import { createConfigLayoutStyles } from './configLayout.styles';
import { createFactionTabsStyles } from './factionTabs.styles';
import { createRoleSelectorStyles } from './roleSelector.styles';

export interface ConfigScreenStyles {
  // ScreenHeader center (board pill + player count)
  headerCenter: ViewStyle;
  templatePill: ViewStyle;
  templatePillText: TextStyle;
  playerCount: TextStyle;
  // Card A (faction tabs)
  cardA: ViewStyle;
  tabBar: ViewStyle;
  tab: ViewStyle;
  tabActive: ViewStyle;
  tabLabel: TextStyle;
  tabLabelActive: TextStyle;
  tabIndicator: ViewStyle;
  // Card B (stepper + role sections)
  cardB: ViewStyle;
  cardBDivider: ViewStyle;
  cardBFooterHint: TextStyle;
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
  chipSelectedThird: ViewStyle;
  chipText: TextStyle;
  chipTextSelected: TextStyle;
  chipVariant: ViewStyle;
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
}

export const createConfigScreenStyles = (colors: ThemeColors): ConfigScreenStyles =>
  StyleSheet.create<ConfigScreenStyles>({
    ...createConfigLayoutStyles(colors),
    ...createFactionTabsStyles(colors),
    ...createRoleSelectorStyles(colors),
  });
