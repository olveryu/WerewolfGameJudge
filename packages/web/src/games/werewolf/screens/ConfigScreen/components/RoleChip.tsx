/**
 * RoleChip — role selection chip. Selected chips take the section's faction color; variant
 * chips wear a thicker border. Tapping the chip body opens its role info card (long press
 * does the same); the corner badge toggles the role on/off the board.
 */
import { useLongPress } from '@/features/room/hooks/useLongPress';
import type { FactionColorKey } from '@/games/werewolf/screens/ConfigScreen/configHelpers';
import { TESTIDS } from '@/testids';

interface RoleChipProps {
  readonly id: string;
  readonly label: string;
  readonly selected: boolean;
  readonly onToggle: (id: string) => void;
  /** Faction color of the selected state. */
  readonly faction: FactionColorKey;
  /** Whether this chip has variant alternatives (thick border hint). */
  readonly hasVariants?: boolean;
  /** Long-press handler for showing the role info card. */
  readonly onInfoPress?: (id: string) => void;
}

/**
 * Role chip component.
 *
 * The body opens the role info card; the corner badge toggles the role. The two buttons are
 * siblings, not nested: a button cannot contain a button, and the badge's pointer events
 * never start the body's long-press timer.
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
  const { consumeLongPress, ...longPressHandlers } = useLongPress(
    onInfoPress === undefined ? null : () => onInfoPress(id),
  );
  return (
    <span
      className="config-role-chip"
      data-faction={faction}
      data-variants={hasVariants}
      data-selected={selected}
    >
      <button
        type="button"
        className="config-role-chip-body"
        data-testid={TESTIDS.configRoleChip(id)}
        {...longPressHandlers}
        onClick={() => {
          if (consumeLongPress()) return;
          if (onInfoPress !== undefined) onInfoPress(id);
        }}
      >
        {label}
      </button>
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
