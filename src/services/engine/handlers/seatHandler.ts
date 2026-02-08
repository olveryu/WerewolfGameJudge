/**
 * Seat Handler - 座位操作处理器（Host-only）
 *
 * 职责：
 * - 处理 JOIN_SEAT / LEAVE_MY_SEAT intent
 * - 所有校验（state/uid/座位有效性/重复占座）集中在此，Facade 不做任何校验
 *
 * ✅ 允许：座位校验 + 返回 StateAction 列表
 * ❌ 禁止：IO（网络 / 音频 / Alert）
 * ❌ 禁止：直接修改 state（返回 StateAction 列表由 reducer 执行）
 */

import type { JoinSeatIntent, LeaveMySeatIntent } from '@/services/engine/intents/types';
import type { HandlerContext, HandlerResult } from './types';
import type { PlayerJoinAction, PlayerLeaveAction } from '@/services/engine/reducer/types';
import {
  REASON_NO_STATE,
  REASON_NOT_AUTHENTICATED,
  REASON_NOT_SEATED,
  REASON_INVALID_SEAT,
  REASON_SEAT_TAKEN,
  REASON_GAME_IN_PROGRESS,
} from '@/services/protocol/reasonCodes';

/**
 * 处理加入座位
 * 支持换座：如果玩家已有座位，会先清空旧座位
 */
export function handleJoinSeat(intent: JoinSeatIntent, context: HandlerContext): HandlerResult {
  const { seat, uid, displayName, avatarUrl } = intent.payload;
  const { state } = context;

  // 校验：state 是否存在
  if (!state) {
    return {
      success: false,
      reason: REASON_NO_STATE,
      actions: [],
    };
  }

  // 校验：uid 是否有效
  if (!uid) {
    return {
      success: false,
      reason: REASON_NOT_AUTHENTICATED,
      actions: [],
    };
  }

  // 验证：座位是否存在
  if (!(seat in state.players)) {
    return {
      success: false,
      reason: REASON_INVALID_SEAT,
      actions: [],
    };
  }

  // 验证：座位是否已被占用（被其他玩家）
  const existingPlayer = state.players[seat];
  if (existingPlayer !== null && existingPlayer.uid !== uid) {
    return {
      success: false,
      reason: REASON_SEAT_TAKEN,
      actions: [],
    };
  }

  // 验证：游戏状态是否允许加入
  if (state.status !== 'unseated' && state.status !== 'seated') {
    return {
      success: false,
      reason: REASON_GAME_IN_PROGRESS,
      actions: [],
    };
  }

  const actions: (PlayerJoinAction | PlayerLeaveAction)[] = [];

  // 检查玩家是否已在其他座位（换座场景）
  for (const [seatKey, player] of Object.entries(state.players)) {
    const seatNum = Number(seatKey);
    if (player?.uid === uid && seatNum !== seat) {
      // 先离开旧座位
      const leaveAction: PlayerLeaveAction = {
        type: 'PLAYER_LEAVE',
        payload: { seat: seatNum },
      };
      actions.push(leaveAction);
      break; // 只可能有一个旧座位
    }
  }

  // 加入新座位
  const joinAction: PlayerJoinAction = {
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
  actions.push(joinAction);

  return {
    success: true,
    actions,
    sideEffects: [{ type: 'BROADCAST_STATE' }, { type: 'SAVE_STATE' }],
  };
}

/**
 * 处理离开"我的座位"
 *
 * 不需要 payload 中指定 seat，seat 从 context.mySeat 获取
 * 如果未入座 (mySeat === null)，返回 REASON_NOT_SEATED
 */
export function handleLeaveMySeat(
  intent: LeaveMySeatIntent,
  context: HandlerContext,
): HandlerResult {
  const { uid } = intent.payload;
  const { state, mySeat } = context;

  // 校验：state 是否存在
  if (!state) {
    return {
      success: false,
      reason: REASON_NO_STATE,
      actions: [],
    };
  }

  // 校验：uid 是否有效
  if (!uid) {
    return {
      success: false,
      reason: REASON_NOT_AUTHENTICATED,
      actions: [],
    };
  }

  // 校验：是否已入座
  if (mySeat === null) {
    return {
      success: false,
      reason: REASON_NOT_SEATED,
      actions: [],
    };
  }

  // 验证：游戏状态是否允许离开
  if (state.status === 'ongoing') {
    return {
      success: false,
      reason: REASON_GAME_IN_PROGRESS,
      actions: [],
    };
  }

  const action: PlayerLeaveAction = {
    type: 'PLAYER_LEAVE',
    payload: { seat: mySeat },
  };

  return {
    success: true,
    actions: [action],
    sideEffects: [{ type: 'BROADCAST_STATE' }, { type: 'SAVE_STATE' }],
  };
}
