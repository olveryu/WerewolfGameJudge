/**
 * ViewedRole handler -- marks a player as having viewed their assigned role.
 *
 * PR2: VIEWED_ROLE (assigned -> ready).
 * When all players have viewed, reducer transitions status -> GameStatus.Ready.
 */

import { GameStatus } from '../../models';
import type { ViewedRoleIntent } from '../intents/types';
import type { PlayerViewedRoleAction } from '../reducer/types';
import type { HandlerContext, HandlerResult } from './types';
import { handlerError, handlerSuccess, STANDARD_SIDE_EFFECTS } from './types';

/**
 * Handle a player's viewed-role intent.
 *
 * Validates seat ownership and status, returns a PLAYER_VIEWED_ROLE action.
 */
export function handleViewedRole(intent: ViewedRoleIntent, context: HandlerContext): HandlerResult {
  const { seat } = intent.payload;
  const { state, mySeat } = context;

  // Validate: state must exist (null-state guard must come first)
  if (!state) {
    return handlerError('no_state');
  }

  // Validate: seat ownership (Host may mark any seat for bot control; non-Host can only mark own seat)
  if (state.hostUserId !== context.myUserId && mySeat !== seat) {
    return handlerError('not_my_seat');
  }

  // Validate: status must be GameStatus.Assigned
  if (state.status !== GameStatus.Assigned) {
    return handlerError('invalid_status');
  }

  // Validate: seat has a player
  if (!state.players[seat]) {
    return handlerError('not_seated');
  }

  const action: PlayerViewedRoleAction = {
    type: 'PLAYER_VIEWED_ROLE',
    payload: { seat },
  };

  return handlerSuccess([action], STANDARD_SIDE_EFFECTS);
}
