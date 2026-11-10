/** RoleStepper — [-] count [+] control for bulk roles such as plain wolf / villager. */
import type { RoleId } from '@game-judge/game-engine/games/werewolf/public';

import type { FactionColorKey } from '@/games/werewolf/screens/ConfigScreen/configHelpers';
import { TESTIDS } from '@/testids';

interface RoleStepperProps {
  readonly roleId: RoleId;
  readonly label: string;
  readonly count: number;
  readonly maxCount: number;
  readonly onCountChange: (roleId: RoleId, newCount: number) => void;
  readonly faction: FactionColorKey;
}

export function RoleStepper({
  roleId,
  label,
  count,
  maxCount,
  onCountChange,
  faction,
}: RoleStepperProps) {
  return (
    <div className="config-stepper-row" data-faction={faction}>
      <span className="config-stepper-label">{label}</span>
      <span className="config-stepper-pill" data-active={count > 0}>
        <button
          type="button"
          className="config-stepper-button"
          aria-label={`减少${label}`}
          disabled={count <= 0}
          onClick={() => onCountChange(roleId, count - 1)}
          data-testid={TESTIDS.configStepperDec(roleId)}
        >
          −
        </button>
        <span className="config-stepper-count" data-testid={TESTIDS.configStepperCount(roleId)}>
          {count}
        </span>
        <button
          type="button"
          className="config-stepper-button"
          aria-label={`增加${label}`}
          disabled={count >= maxCount}
          onClick={() => onCountChange(roleId, count + 1)}
          data-testid={TESTIDS.configStepperInc(roleId)}
        >
          +
        </button>
      </span>
    </div>
  );
}
