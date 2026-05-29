/**
 * RoleChip - role selection chip (memoized)
 *
 * Selected state uses faction color. Renders UI and reports onToggle via callback; does not import service, contains no business logic.
 * Variant chips use thicker borders to differentiate. All chips support long-press to view ability info (variant roles toggle variants in-card).
 */
import { memo } from 'react';
import { Text, TouchableOpacity } from 'react-native';

import { TESTIDS } from '@/testids';
import { fixed } from '@/theme';

import { type ConfigScreenStyles } from './styles';

/** Faction color key. */
export type FactionColorKey = 'wolf' | 'god' | 'villager' | 'third';

interface RoleChipProps {
  id: string;
  label: string;
  selected: boolean;
  onToggle: (id: string) => void;
  styles: ConfigScreenStyles;
  /** Faction color key for the selected state. Falls back to primary if omitted. */
  factionColor?: FactionColorKey;
  /** Accent color for selected text. Falls back to text color if omitted. */
  accentColor?: string;
  /** Whether this chip has variant alternatives (dual-color border hint). */
  hasVariants?: boolean;
  /** Long-press handler for showing role info card (all chips). */
  onInfoPress?: (id: string) => void;
}

const FACTION_STYLE_MAP: Record<FactionColorKey, keyof ConfigScreenStyles> = {
  wolf: 'chipSelectedWolf',
  god: 'chipSelectedGod',
  villager: 'chipSelectedVillager',
  third: 'chipSelectedThird',
};

/** Role chip component. */
export const RoleChip = memo<RoleChipProps>(
  ({
    id,
    label,
    selected,
    onToggle,
    styles,
    factionColor,
    accentColor,
    hasVariants,
    onInfoPress,
  }) => {
    const selectedStyle = factionColor
      ? styles[FACTION_STYLE_MAP[factionColor]]
      : styles.chipSelected;

    const handleLongPress = onInfoPress ? () => onInfoPress(id) : undefined;

    return (
      <TouchableOpacity
        testID={TESTIDS.configRoleChip(id)}
        style={[styles.chip, hasVariants && styles.chipVariant, selected && selectedStyle]}
        onPress={() => onToggle(id)}
        onLongPress={handleLongPress}
        activeOpacity={fixed.activeOpacity}
        accessibilityLabel={label}
        accessibilityState={{ selected }}
      >
        <Text
          style={[
            styles.chipText,
            selected && styles.chipTextSelected,
            selected && accentColor ? { color: accentColor } : undefined,
          ]}
        >
          {label}
        </Text>
      </TouchableOpacity>
    );
  },
);

RoleChip.displayName = 'RoleChip';
