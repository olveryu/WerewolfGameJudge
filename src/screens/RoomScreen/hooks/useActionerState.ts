/**
 * useActionerState.ts - Memoized actioner state derivation
 *
 * This hook wraps the pure `determineActionerState` helper with useMemo.
 *
 * ❌ Do NOT: call services, push state, advance game phase
 * ✅ Allowed: memoize derived state from props
 */

import type { RoleAction } from '@werewolf/game-engine/models/actions/RoleAction';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { ActionSchema } from '@werewolf/game-engine/models/roles/spec';
import { useMemo } from 'react';

import {
  type ActionerState,
  determineActionerState,
} from '@/screens/RoomScreen/RoomScreen.helpers';

export interface UseActionerStateParams {
  /** Actor's role (actorRoleForUi — may be bot's role when Host is delegating) */
  actorRole: RoleId | null;
  /** Currently acting role in night phase */
  currentActionRole: RoleId | null;
  /** Current action schema (Phase 3: schema-driven UI) */
  currentSchema: ActionSchema | null;
  /** Actor's seat number (actorSeatForUi — may be bot's seat when Host is delegating) */
  actorSeatNumber: number | null;
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
  actorRole,
  currentActionRole,
  currentSchema,
  actorSeatNumber,
  wolfVotes,
  isHost,
  actions,
}: UseActionerStateParams): ActionerState {
  return useMemo(() => {
    return determineActionerState(
      actorRole,
      currentActionRole,
      currentSchema,
      actorSeatNumber,
      wolfVotes,
      isHost,
      actions,
    );
  }, [actorRole, currentActionRole, currentSchema, actorSeatNumber, wolfVotes, isHost, actions]);
}
