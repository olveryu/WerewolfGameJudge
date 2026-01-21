/**
 * Seat Handler - 座位相关处理器
 *
 * 处理 JOIN_SEAT / LEAVE_SEAT intent
 */

import type { JoinSeatIntent, LeaveSeatIntent } from '../intents/types';
import type { HandlerContext, HandlerResult } from './types';
import type { PlayerJoinAction, PlayerLeaveAction } from '../reducer/types';

/**
 * 处理加入座位
 */
export function handleJoinSeat(intent: JoinSeatIntent, context: HandlerContext): HandlerResult {
  const { seat, uid, displayName, avatarUrl } = intent.payload;
  const { state } = context;

  // 验证：座位是否存在
  if (!(seat in state.players)) {
    return {
      success: false,
      reason: 'invalid_seat',
      actions: [],
    };
  }

  // 验证：座位是否已被占用
  const existingPlayer = state.players[seat];
  if (existingPlayer !== null) {
    return {
      success: false,
      reason: 'seat_taken',
      actions: [],
    };
  }

  // 验证：游戏状态是否允许加入
  if (state.status !== 'unseated' && state.status !== 'seated') {
    return {
      success: false,
      reason: 'game_in_progress',
      actions: [],
    };
  }

  const action: PlayerJoinAction = {
    type: 'PLAYER_JOIN',
    payload: {
      seat,
      player: {
        uid,
        seatNumber: seat,
        displayName,
        avatarUrl,
        role: null,
        hasViewedRole: false,
      },
    },
  };

  return {
    success: true,
    actions: [action],
    sideEffects: [{ type: 'BROADCAST_STATE' }, { type: 'SAVE_STATE' }],
  };
}

/**
 * 处理离开座位
 */
export function handleLeaveSeat(intent: LeaveSeatIntent, context: HandlerContext): HandlerResult {
  const { seat, uid } = intent.payload;
  const { state } = context;

  // 验证：座位是否存在
  if (!(seat in state.players)) {
    return {
      success: false,
      reason: 'invalid_seat',
      actions: [],
    };
  }

  // 验证：座位上是否有玩家
  const player = state.players[seat];
  if (player === null) {
    return {
      success: false,
      reason: 'seat_empty',
      actions: [],
    };
  }

  // 验证：是否是该玩家的座位
  if (player.uid !== uid) {
    return {
      success: false,
      reason: 'not_your_seat',
      actions: [],
    };
  }

  // 验证：游戏状态是否允许离开
  if (state.status === 'ongoing') {
    return {
      success: false,
      reason: 'game_in_progress',
      actions: [],
    };
  }

  const action: PlayerLeaveAction = {
    type: 'PLAYER_LEAVE',
    payload: { seat },
  };

  return {
    success: true,
    actions: [action],
    sideEffects: [{ type: 'BROADCAST_STATE' }, { type: 'SAVE_STATE' }],
  };
}
