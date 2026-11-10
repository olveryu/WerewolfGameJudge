/**
 * RoleChip — role selection chip. Selected chips take the section's faction color; variant
 * chips wear a thicker border. Every chip opens its role info card on long press.
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

/** Role chip component. */
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
    <button
      type="button"
      className="config-role-chip"
      data-faction={faction}
      data-variants={hasVariants}
      aria-pressed={selected}
      data-testid={TESTIDS.configRoleChip(id)}
      {...longPressHandlers}
      onClick={() => {
        if (consumeLongPress()) return;
        onToggle(id);
      }}
    >
      {label}
    </button>
  );
}
