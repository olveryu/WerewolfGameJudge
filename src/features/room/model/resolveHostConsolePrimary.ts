/**
 * Derivation of the collapsed host console's primary row from the panel
 * action data. The console re-presents the model's single primary action;
 * it never introduces a second execution path.
 */

import type { RoomHostManagementModel, RoomHostRemedy } from './RoomHostManagement';

export type RoomHostConsolePrimary =
  | {
      /** Executable now: pressing the console row runs the action's own onPress. */
      readonly kind: 'ready';
      readonly actionKey: string;
      readonly label: string;
      readonly onPress: () => void;
    }
  | {
      /** Not executable yet: the reason renders on the console itself, beside the action label. */
      readonly kind: 'blocked';
      readonly actionKey: string;
      readonly label: string;
      readonly reason: string;
      readonly remedy: RoomHostRemedy | null;
    };

/**
 * Resolve the console primary from the host management model:
 * - an enabled primary becomes ready (the console row runs the action's
 *   own `onPress` — one press behavior per action, on every surface);
 * - a primary carrying a non-empty `consoleBlockedReason` renders blocked
 *   with that reason even while the panel action stays enabled;
 * - a disabled primary with a non-empty reason becomes blocked;
 * - a disabled primary without a reason (transient submission lock) and
 *   models without a primary yield no console row.
 *
 * More than one primary is a model construction error and fails fast.
 */
export function resolveHostConsolePrimary(
  model: RoomHostManagementModel,
): RoomHostConsolePrimary | null {
  const primaries = model.sections
    .flatMap((section) => section.actions)
    .filter((action) => action.isPrimary === true);
  if (primaries.length === 0) return null;
  if (primaries.length > 1) {
    throw new Error(
      `Host management model carries ${primaries.length} primary actions; at most one is allowed`,
    );
  }
  const action = primaries[0];
  if (action === undefined) return null;

  const consoleReason = action.consoleBlockedReason;
  if (consoleReason !== null && consoleReason !== undefined && consoleReason.length > 0) {
    return {
      kind: 'blocked',
      actionKey: action.key,
      label: action.label,
      reason: consoleReason,
      remedy: action.remedy ?? null,
    };
  }
  if (action.isEnabled) {
    return {
      kind: 'ready',
      actionKey: action.key,
      label: action.label,
      onPress: action.onPress,
    };
  }
  const reason = action.disabledReason;
  if (reason === null || reason.length === 0) return null;
  return {
    kind: 'blocked',
    actionKey: action.key,
    label: action.label,
    reason,
    remedy: action.remedy ?? null,
  };
}
