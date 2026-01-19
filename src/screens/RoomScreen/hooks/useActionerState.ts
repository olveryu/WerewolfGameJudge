/**
 * useActionerState.ts - Memoized actioner state derivation
 *
 * This hook wraps the pure `determineActionerState` helper with useMemo.
 *
 * ❌ Do NOT: call services, push state, advance game phase
 * ✅ Allowed: memoize derived state from props
 */

import { useMemo } from 'react';
import type { RoleId } from '../../../models/roles';
import type { RoleAction } from '../../../models/actions/RoleAction';
import type { ActionSchema } from '../../../models/roles/spec';
import { determineActionerState, type ActionerState } from '../RoomScreen.helpers';

export interface UseActionerStateParams {
  /** Current player's role */
  myRole: RoleId | null;
  /** Currently acting role in night phase */
  currentActionRole: RoleId | null;
  /** Current action schema (Phase 3: schema-driven UI) */
  currentSchema: ActionSchema | null;
  /** Current player's seat number */
  mySeatNumber: number | null;
  /** Wolf votes map (seatNumber -> targetSeat) */
  wolfVotes: Map<number, number>;
  /** Whether current player is host */
  isHost: boolean;
  /** Already submitted role actions */
  actions: Map<RoleId, RoleAction>;
}

/**
 * Derives actionerState (imActioner, showWolves) from current game state.
 * Returns a stable object via useMemo.
 */
export function useActionerState({
  myRole,
  currentActionRole,
  currentSchema,
  mySeatNumber,
  wolfVotes,
  isHost,
  actions,
}: UseActionerStateParams): ActionerState {
  return useMemo(() => {
    return determineActionerState(
      myRole,
      currentActionRole,
      currentSchema,
      mySeatNumber,
      wolfVotes,
      isHost,
      actions,
    );
  }, [myRole, currentActionRole, currentSchema, mySeatNumber, wolfVotes, isHost, actions]);
}
