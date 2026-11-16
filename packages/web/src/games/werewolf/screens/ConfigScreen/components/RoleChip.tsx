/**
 * RoleChip — role selection chip. Selected chips take the section's faction color; chips
 * with variant alternatives wear the 变 mark in the top-left corner. Tapping the chip
 * body opens its role info card; the corner badge toggles the role on/off the board.
 */
import type { FactionColorKey } from '@/games/werewolf/screens/ConfigScreen/configHelpers';
import { TESTIDS } from '@/testids';

interface RoleChipProps {
  readonly id: string;
  readonly label: string;
  readonly selected: boolean;
  readonly onToggle: (id: string) => void;
  /** Faction color of the selected state. */
  readonly faction: FactionColorKey;
  /** Whether this chip has variant alternatives (shows the 变 mark). */
  readonly hasVariants?: boolean;
  /** Tap handler for showing the role info card. */
  readonly onInfoPress?: (id: string) => void;
}

/**
 * Role chip component.
 *
 * The body opens the role info card; the corner badge toggles the role. The two buttons are
 * siblings, not nested: a button cannot contain a button. The 变 mark is a decorative
 * indicator (pointer-events: none), so it never steals taps from the body.
 */
export function RoleChip({
  id,
  label,
  selected,
  onToggle,
  faction,
  hasVariants = false,
  onInfoPress,
}: RoleChipProps) {
  return (
    <span className="config-role-chip" data-faction={faction} data-selected={selected}>
      <button
        type="button"
        className="config-role-chip-body"
        data-testid={TESTIDS.configRoleChip(id)}
        onClick={() => {
          if (onInfoPress !== undefined) onInfoPress(id);
        }}
      >
        {label}
      </button>
      {hasVariants && (
        <span className="config-role-chip-variant-mark" aria-hidden="true">
          变
        </span>
      )}
      <button
        type="button"
        className="config-role-chip-badge"
        data-testid={TESTIDS.configRoleChipToggle(id)}
        aria-label={selected ? `移出${label}` : `加入${label}`}
        aria-pressed={selected}
        onClick={() => onToggle(id)}
      >
        {selected ? '✓' : '＋'}
      </button>
    </span>
  );
}
