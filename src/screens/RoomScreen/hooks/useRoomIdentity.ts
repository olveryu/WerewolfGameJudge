/**
 * useRoomIdentity — Derives the UI actor identity from raw game-room primitives.
 *
 * Wraps getActorIdentity in a useMemo and adds a delegation validity warning effect.
 * Pure derivation only — does not own state, submit actions, or produce side-effects
 * beyond the diagnostic log.
 */

import type { RoleId } from '@werewolf/game-engine/models/roles';
import { useEffect, useMemo } from 'react';

import { roomScreenLog } from '@/utils/logger';

import { getActorIdentity, isActorIdentityValid } from '../policy';

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

interface UseRoomIdentityInput {
  /** My real seat number (null if not seated) */
  mySeatNumber: number | null;
  /** My real role (null if no role assigned) */
  myRole: RoleId | null;
  /** Effective seat (= controlledSeat ?? mySeatNumber, computed by useGameRoom) */
  effectiveSeat: number | null;
  /** Effective role (= role of effectiveSeat, computed by useGameRoom) */
  effectiveRole: RoleId | null;
  /** Currently controlled bot seat (null if not controlling) */
  controlledSeat: number | null;
}

interface UseRoomIdentityResult {
  /** The seat number to use for all action-related UI decisions */
  actorSeatForUi: number | null;
  /** The role to use for all action-related UI decisions */
  actorRoleForUi: RoleId | null;
  /** True if Host is currently delegating to a bot seat */
  isDelegating: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook
// ─────────────────────────────────────────────────────────────────────────────

export function useRoomIdentity(input: UseRoomIdentityInput): UseRoomIdentityResult {
  const { mySeatNumber, myRole, effectiveSeat, effectiveRole, controlledSeat } = input;

  const actorIdentity = useMemo(
    () =>
      getActorIdentity({
        mySeatNumber,
        myRole,
        effectiveSeat,
        effectiveRole,
        controlledSeat,
      }),
    [mySeatNumber, myRole, effectiveSeat, effectiveRole, controlledSeat],
  );

  const { actorSeatForUi, actorRoleForUi, isDelegating } = actorIdentity;

  // FAIL-FAST: Log warning when delegating but identity is invalid
  useEffect(() => {
    if (isDelegating && !isActorIdentityValid(actorIdentity)) {
      roomScreenLog.warn('Invalid delegation state detected', {
        controlledSeat,
        effectiveSeat,
        effectiveRole,
        actorSeatForUi,
        actorRoleForUi,
        hint: 'effectiveSeat should equal controlledSeat when delegating',
      });
    }
  }, [
    isDelegating,
    actorIdentity,
    controlledSeat,
    effectiveSeat,
    effectiveRole,
    actorSeatForUi,
    actorRoleForUi,
  ]);

  return { actorSeatForUi, actorRoleForUi, isDelegating };
}
