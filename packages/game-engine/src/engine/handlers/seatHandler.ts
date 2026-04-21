/**
 * Seat Handler - 座位操作处理器（Host-only）
 *
 * 职责：
 * - 处理 JOIN_SEAT / LEAVE_MY_SEAT intent
 * - 所有校验（state/userId/座位有效性/重复占座）集中在此，Facade 不做任何校验
 *
 * 提供座位校验并返回 StateAction 列表，不包含 IO（网络 / 音频 / Alert），
 * 不直接修改 state（返回 StateAction 列表由 reducer 执行）。
 */

import { GameStatus } from '../../models';
import {
  REASON_GAME_IN_PROGRESS,
  REASON_INVALID_SEAT,
  REASON_NO_STATE,
  REASON_NOT_AUTHENTICATED,
  REASON_NOT_HOST,
  REASON_NOT_SEATED,
  REASON_SEAT_EMPTY,
  REASON_SEAT_TAKEN,
} from '../../protocol/reasonCodes';
import { forEachSeatedPlayer } from '../../utils/playerHelpers';
import type {
  ClearAllSeatsIntent,
  JoinSeatIntent,
  KickPlayerIntent,
  LeaveMySeatIntent,
  UpdatePlayerProfileIntent,
} from '../intents/types';
import type {
  PlayerJoinAction,
  PlayerLeaveAction,
  UpdatePlayerProfileAction,
} from '../reducer/types';
import type { HandlerContext, HandlerResult } from './types';
import { handlerError, handlerSuccess, STANDARD_SIDE_EFFECTS } from './types';

/**
 * 处理加入座位
 * 支持换座：如果玩家已有座位，会先清空旧座位
 */
export function handleJoinSeat(intent: JoinSeatIntent, context: HandlerContext): HandlerResult {
  const { seat, userId, displayName, avatarUrl, avatarFrame, seatFlair, nameStyle, level } =
    intent.payload;
  const { state } = context;

  // 校验：state 是否存在
  if (!state) {
    return handlerError(REASON_NO_STATE);
  }

  // 校验：userId 是否有效
  if (!userId) {
    return handlerError(REASON_NOT_AUTHENTICATED);
  }

  // 验证：座位是否存在
  if (!(seat in state.players)) {
    return handlerError(REASON_INVALID_SEAT);
  }

  // 验证：座位是否已被占用（被其他玩家）
  const existingPlayer = state.players[seat];
  if (existingPlayer !== null && existingPlayer.userId !== userId) {
    return handlerError(REASON_SEAT_TAKEN);
  }

  // 验证：游戏状态是否允许加入
  if (state.status !== GameStatus.Unseated && state.status !== GameStatus.Seated) {
    return handlerError(REASON_GAME_IN_PROGRESS);
  }

  const actions: (PlayerJoinAction | PlayerLeaveAction)[] = [];

  // 检查玩家是否已在其他座位（换座场景）
  for (const [seatKey, player] of Object.entries(state.players)) {
    const seatNum = Number(seatKey);
    if (player?.userId === userId && seatNum !== seat) {
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
        userId,
        seatNumber: seat,
        role: null,
        hasViewedRole: false,
      },
      rosterEntry: {
        displayName,
        avatarUrl,
        avatarFrame,
        seatFlair,
        nameStyle,
        level,
      },
    },
  };
  actions.push(joinAction);

  return handlerSuccess(actions, STANDARD_SIDE_EFFECTS);
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
  const { userId } = intent.payload;
  const { state, mySeat } = context;

  // 校验：state 是否存在
  if (!state) {
    return handlerError(REASON_NO_STATE);
  }

  // 校验：userId 是否有效
  if (!userId) {
    return handlerError(REASON_NOT_AUTHENTICATED);
  }

  // 校验：是否已入座
  if (mySeat === null) {
    return handlerError(REASON_NOT_SEATED);
  }

  // 验证：游戏状态是否允许离开（仅 Unseated/Seated 允许）
  if (state.status !== GameStatus.Unseated && state.status !== GameStatus.Seated) {
    return handlerError(REASON_GAME_IN_PROGRESS);
  }

  const action: PlayerLeaveAction = {
    type: 'PLAYER_LEAVE',
    payload: { seat: mySeat },
  };

  return handlerSuccess([action], STANDARD_SIDE_EFFECTS);
}

/**
 * 处理全员起立（Host-only）
 *
 * 清空所有已入座玩家，状态回到 unseated。
 * 前置条件：status in (GameStatus.Unseated, GameStatus.Seated)
 */
export function handleClearAllSeats(
  _intent: ClearAllSeatsIntent,
  context: HandlerContext,
): HandlerResult {
  const { state } = context;

  if (!state) {
    return handlerError(REASON_NO_STATE);
  }

  if (state.status !== GameStatus.Unseated && state.status !== GameStatus.Seated) {
    return handlerError(REASON_GAME_IN_PROGRESS);
  }

  const actions: PlayerLeaveAction[] = [];
  forEachSeatedPlayer(state.players, (seat) => {
    actions.push({ type: 'PLAYER_LEAVE', payload: { seat } });
  });

  return handlerSuccess(actions, STANDARD_SIDE_EFFECTS);
}

/**
 * 更新在座玩家的显示资料（displayName / avatarUrl）
 *
 * 任何在座玩家均可调用（更新自己的资料）。
 * mySeat 由 context 提供（通过 userId 查找），不需要客户端传 seat。
 */
export function handleUpdatePlayerProfile(
  intent: UpdatePlayerProfileIntent,
  context: HandlerContext,
): HandlerResult {
  const { userId, displayName, avatarUrl, avatarFrame, seatFlair, nameStyle } = intent.payload;
  const { state, mySeat } = context;

  if (!state) {
    return handlerError(REASON_NO_STATE);
  }

  if (!userId) {
    return handlerError(REASON_NOT_AUTHENTICATED);
  }

  if (mySeat === null) {
    return handlerError(REASON_NOT_SEATED);
  }

  const action: UpdatePlayerProfileAction = {
    type: 'UPDATE_PLAYER_PROFILE',
    payload: {
      userId,
      displayName,
      avatarUrl,
      avatarFrame,
      seatFlair,
      nameStyle,
    },
  };

  return handlerSuccess([action], STANDARD_SIDE_EFFECTS);
}

/**
 * 处理移出座位（Host-only）
 *
 * Host 可以在 Unseated/Seated 阶段将指定座位的玩家移出座位。
 * 移出后座位变空，如果之前是 Seated 状态会回退到 Unseated。
 */
export function handleKickPlayer(intent: KickPlayerIntent, context: HandlerContext): HandlerResult {
  const { targetSeat } = intent.payload;
  const { state } = context;

  if (!state) {
    return handlerError(REASON_NO_STATE);
  }

  // 校验：只有 Host 可以踢人
  if (state.hostUserId !== context.myUserId) {
    return handlerError(REASON_NOT_HOST);
  }

  // 校验：仅在 Unseated/Seated 阶段
  if (state.status !== GameStatus.Unseated && state.status !== GameStatus.Seated) {
    return handlerError(REASON_GAME_IN_PROGRESS);
  }

  // 校验：座位有效
  if (!(targetSeat in state.players)) {
    return handlerError(REASON_INVALID_SEAT);
  }

  // 校验：座位非空
  if (state.players[targetSeat] === null) {
    return handlerError(REASON_SEAT_EMPTY);
  }

  const action: PlayerLeaveAction = {
    type: 'PLAYER_LEAVE',
    payload: { seat: targetSeat },
  };

  return handlerSuccess([action], STANDARD_SIDE_EFFECTS);
}
