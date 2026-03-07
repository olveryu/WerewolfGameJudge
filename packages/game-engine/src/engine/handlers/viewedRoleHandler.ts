/**
 * ViewedRole handler — marks a player as having viewed their assigned role.
 *
 * PR2: VIEWED_ROLE (assigned → ready).
 * When all players have viewed, reducer transitions status → GameStatus.Ready.
 */

import { GameStatus } from '../../models/GameStatus';
import type { ViewedRoleIntent } from '../intents/types';
import type { PlayerViewedRoleAction } from '../reducer/types';
import type { HandlerContext, HandlerResult } from './types';
import { STANDARD_SIDE_EFFECTS } from './types';

export function handleViewedRole(intent: ViewedRoleIntent, context: HandlerContext): HandlerResult {
  const { seat } = intent.payload;
  const { state, mySeat } = context;

  // 验证：state 必须存在（null-state guard 必须在最前）
  if (!state) {
    return {
      success: false,
      reason: 'no_state',
      actions: [],
    };
  }

  // 验证：座位所有权（Host 可标记任意座位用于 bot 控制；非 Host 只能标记自己的座位）
  if (state.hostUid !== context.myUid && mySeat !== seat) {
    return {
      success: false,
      reason: 'not_my_seat',
      actions: [],
    };
  }

  // 验证：status 必须是 GameStatus.Assigned
  if (state.status !== GameStatus.Assigned) {
    return {
      success: false,
      reason: 'invalid_status',
      actions: [],
    };
  }

  // 验证座位有玩家
  if (!state.players[seat]) {
    return {
      success: false,
      reason: 'not_seated',
      actions: [],
    };
  }

  const action: PlayerViewedRoleAction = {
    type: 'PLAYER_VIEWED_ROLE',
    payload: { seat },
  };

  return {
    success: true,
    actions: [action],
    sideEffects: STANDARD_SIDE_EFFECTS,
  };
}
