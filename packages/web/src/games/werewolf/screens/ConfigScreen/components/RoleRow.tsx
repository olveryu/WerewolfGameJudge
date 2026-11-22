/**
 * RoleRow — one full-width list row for the config editor.
 *
 * The row body toggles the role on/off the board; the trailing info button opens the role
 * info card. The two buttons are siblings, not nested: a button cannot contain a button,
 * and the info button must never toggle the role.
 */
import type { FactionColorKey } from '@/games/werewolf/screens/ConfigScreen/configHelpers';
import { TESTIDS } from '@/testids';
import IconInformationCircleOutline from '~icons/ion/information-circle-outline';

interface RoleRowProps {
  readonly id: string;
  readonly label: string;
  /** One-line skill from the role spec, rendered under the name. */
  readonly oneLiner: string;
  readonly selected: boolean;
  readonly onToggle: (id: string) => void;
  /** Faction color of the selected state. */
  readonly faction: FactionColorKey;
  /** Tap handler for showing the role info card. */
  readonly onInfoPress?: (id: string) => void;
}

/** Full-width toggle row with a separate 44px info button. */
export function RoleRow({
  id,
  label,
  oneLiner,
  selected,
  onToggle,
  faction,
  onInfoPress,
}: RoleRowProps) {
  return (
    <div className="config-role-row" data-faction={faction} data-selected={selected}>
      <button
        type="button"
        className="config-role-row-main"
        data-testid={TESTIDS.configRoleRow(id)}
        aria-pressed={selected}
        onClick={() => onToggle(id)}
      >
        <span className="config-role-row-check" aria-hidden="true">
          {selected ? '✓' : ''}
        </span>
        <span className="config-role-row-text">
          <span className="config-role-row-label">{label}</span>
          <span className="config-role-row-skill">{oneLiner}</span>
        </span>
      </button>
      <button
        type="button"
        className="config-role-row-info"
        data-testid={TESTIDS.configRoleRowInfo(id)}
        aria-label={`查看${label}介绍`}
        onClick={() => {
          if (onInfoPress !== undefined) onInfoPress(id);
        }}
      >
        <IconInformationCircleOutline aria-hidden />
      </button>
    </div>
  );
}
