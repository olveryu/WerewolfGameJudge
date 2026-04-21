/**
 * useActionerState.ts - Memoized actioner state derivation
 *
 * This hook wraps the pure `determineActionerState` helper with useMemo.
 * Memoizes derived state from props. Does not call services, push state,
 * or advance game phase.
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
  actorSeat: number | null;
  /** Wolf votes map (seat -> targetSeat) */
  wolfVotes: Map<number, number>;
  /** Already submitted role actions */
  actions: Map<RoleId, RoleAction>;
  /** The role treasureMaster chose from bottom cards (if any) */
  treasureMasterChosenCard?: RoleId | null;
  /** The role thief chose from bottom cards (if any) */
  thiefChosenCard?: RoleId | null;
}

/**
 * Derives actionerState (imActioner, showWolves) from current game state.
 * Returns a stable object via useMemo.
 */
export function useActionerState({
  actorRole,
  currentActionRole,
  currentSchema,
  actorSeat,
  wolfVotes,
  actions,
  treasureMasterChosenCard,
  thiefChosenCard,
}: UseActionerStateParams): ActionerState {
  return useMemo(() => {
    return determineActionerState(
      actorRole,
      currentActionRole,
      currentSchema,
      actorSeat,
      wolfVotes,
      actions,
      treasureMasterChosenCard,
      thiefChosenCard,
    );
  }, [
    actorRole,
    currentActionRole,
    currentSchema,
    actorSeat,
    wolfVotes,
    actions,
    treasureMasterChosenCard,
    thiefChosenCard,
  ]);
}
