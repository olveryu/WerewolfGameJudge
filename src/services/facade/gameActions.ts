/**
 * Game Actions - 游戏 HTTP API 业务编排
 *
 * 拆分自 GameFacade.ts（纯重构 PR，无行为变更）
 *
 * 职责：
 * - Host-only 游戏控制方法（assignRoles/startNight/restartGame 等）→ HTTP API
 * - 夜晚行动方法（submitAction/submitWolfVote）→ HTTP API
 * - 任意玩家动作（markViewedRole）→ HTTP API
 * - 夜晚控制（endNight/setAudioPlaying/postAudioAck/postProgression）→ HTTP API
 *
 * 客户端只发 roomCode + 业务参数，不发 hostUid。
 * 服务端从 DB 中的 state.hostUid 做鉴权（buildHandlerContext(state, state.hostUid)）。
 *
 * 服务端内联推进（inline progression）在 action 处理后自动执行。
 * 客户端不再驱动推进循环，只需：
 * - 提交操作 → 服务端返回 pendingAudioEffects
 * - 播放音频 → POST audio-ack → 服务端继续推进
 * - wolf vote deadline 到期 → POST progression
 *
 * 禁止：
 * - 业务逻辑/校验规则（全部在 handler / 服务端）
 * - 直接修改 state（全部在 reducer / 服务端）
 */

import type { GameStore } from '@werewolf/game-engine/engine/store';
import type { GameState } from '@werewolf/game-engine/engine/store/types';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import type { RoleRevealAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';
import { secureRng } from '@werewolf/game-engine/utils/random';

import type { AudioService } from '@/services/infra/AudioService';
import { facadeLog } from '@/utils/logger';

import { type ApiResponse, applyOptimisticUpdate, callApiOnce } from './apiUtils';

/**
 * gameActions 依赖的上下文接口
 * （从 Facade 注入，避免循环依赖）
 */
export interface GameActionsContext {
  readonly store: GameStore;
  myUid: string | null;
  getMySeatNumber: () => number | null;
  /** AudioService 实例（用于 preload 等直接调用） */
  audioService: AudioService;
}

// =============================================================================
// Game Control API (HTTP — Phase 2)
// =============================================================================

/** Game Control API 响应（re-export from apiUtils） */
type GameControlApiResponse = ApiResponse;

/**
 * 调用 Game Control API（内置客户端重试）
 *
 * 服务端乐观锁冲突返回 CONFLICT_RETRY 时，客户端透明重试（最多 2 次），
 * 配合服务端 3 次重试，有效重试上限为 3×3 = 9 次。
 *
 * 支持客户端乐观更新：传入 `optimisticFn` 在 fetch 前即时渲染预测 state，
 * 服务端响应后 applySnapshot 覆盖；失败时 rollbackOptimistic。
 */
async function callGameControlApi(
  path: string,
  body: Record<string, unknown>,
  store?: GameStore,
  optimisticFn?: (state: GameState) => GameState,
): Promise<GameControlApiResponse> {
  const MAX_CLIENT_RETRIES = 2;

  // 乐观更新：fetch 前立即渲染预测 state
  applyOptimisticUpdate(store, optimisticFn);

  for (let attempt = 0; attempt <= MAX_CLIENT_RETRIES; attempt++) {
    const result = await callApiOnce(path, body, 'callGameControlApi', store);

    // 网络/服务端错误已在 callApiOnce 中处理
    if (result.reason === 'NETWORK_ERROR' || result.reason === 'SERVER_ERROR') {
      return result;
    }

    // 乐观锁冲突 → 客户端透明重试（退避 + 随机抖动）
    if (result.reason === 'CONFLICT_RETRY' && attempt < MAX_CLIENT_RETRIES) {
      const delay = 100 * (attempt + 1) + secureRng() * 50;
      facadeLog.warn('CONFLICT_RETRY, client retrying', { path, attempt: attempt + 1 });
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    return result;
  }

  // 重试耗尽 → 回滚乐观更新
  if (store) store.rollbackOptimistic();
  return { success: false, reason: 'CONFLICT_RETRY' };
}

// ---------------------------------------------------------------------------
// Connection guard (DRY)
// ---------------------------------------------------------------------------
const NOT_CONNECTED = { success: false, reason: 'NOT_CONNECTED' } as const;

/**
 * Extract roomCode + 当前用户 uid from context.
 *
 * 仅用于任意玩家可调用的动作（markViewedRole），uid 来自 ctx.myUid（调用者自身）。
 * Host-only 动作统一使用 getRoomCodeOrFail（只需 roomCode，服务端从 state 读取 hostUid）。
 * 返回 null 表示未连接，调用方应返回 NOT_CONNECTED。
 */
function getConnectionOrFail(ctx: GameActionsContext): { roomCode: string; myUid: string } | null {
  const roomCode = ctx.store.getState()?.roomCode;
  if (!roomCode || !ctx.myUid) return null;
  return { roomCode, myUid: ctx.myUid };
}

/**
 * Extract roomCode from game state.
 *
 * 用于 host-only 动作和夜晚动作。服务端从 state.hostUid 做鉴权，客户端无需发送 hostUid。
 * 与 getConnectionOrFail 不同：后者还读取 ctx.myUid（调用者自身），适用于 view-role 等任意玩家动作。
 * 返回 null 表示未连接，调用方应返回 NOT_CONNECTED。
 */
function getRoomCodeOrFail(ctx: GameActionsContext): { roomCode: string } | null {
  const roomCode = ctx.store.getState()?.roomCode;
  if (!roomCode) return null;
  return { roomCode };
}

/**
 * Host: 分配角色（HTTP API）
 */
export async function assignRoles(
  ctx: GameActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('assignRoles called');

  const conn = getRoomCodeOrFail(ctx);
  if (!conn) return NOT_CONNECTED;
  const { roomCode } = conn;

  return callGameControlApi(
    '/api/game/assign',
    {
      roomCode,
    },
    ctx.store,
  );
}

/**
 * Host/Player: 标记某座位已查看角色（HTTP API）
 */
export async function markViewedRole(
  ctx: GameActionsContext,
  seat: number,
): Promise<{ success: boolean; reason?: string }> {
  const conn = getConnectionOrFail(ctx);
  if (!conn) return NOT_CONNECTED;
  const { roomCode } = conn;

  const result = await callGameControlApi(
    '/api/game/view-role',
    {
      roomCode,
      uid: ctx.myUid,
      seat,
    },
    ctx.store,
    // 乐观预测：立即显示已看牌
    (state) => ({
      ...state,
      players: {
        ...state.players,
        [seat]: state.players[seat]
          ? { ...state.players[seat]!, hasViewedRole: true }
          : state.players[seat],
      },
    }),
  );
  return result;
}

/**
 * Host: 开始夜晚（HTTP API）
 *
 * ready → ongoing. 音频 sideEffects 由客户端按序播放。
 */
export async function startNight(
  ctx: GameActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('startNight called');

  const conn = getRoomCodeOrFail(ctx);
  if (!conn) return NOT_CONNECTED;
  const { roomCode } = conn;

  const result = await callGameControlApi(
    '/api/game/start',
    {
      roomCode,
    },
    ctx.store,
  );

  if (!result.success) {
    return result;
  }

  // Fire-and-forget: preload audio for all template roles before night flow starts.
  const stateAfterStart = ctx.store.getState();
  if (stateAfterStart?.templateRoles) {
    ctx.audioService.preloadForRoles(stateAfterStart.templateRoles as RoleId[]).catch((err) => {
      facadeLog.warn('preloadForRoles failed (non-critical):', err);
    });
  }

  return { success: true };
}

/**
 * Host: 更新模板（HTTP API）
 *
 * 仅在"准备看牌前"（unseated | seated）允许
 */
export async function updateTemplate(
  ctx: GameActionsContext,
  template: GameTemplate,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('updateTemplate called');

  const conn = getRoomCodeOrFail(ctx);
  if (!conn) return NOT_CONNECTED;
  const { roomCode } = conn;

  return callGameControlApi(
    '/api/game/update-template',
    {
      roomCode,
      templateRoles: template.roles,
    },
    ctx.store,
    // 乐观预测：立即更新模板角色列表
    (state) => ({ ...state, templateRoles: template.roles }),
  );
}

/**
 * Host: 重新开始游戏（HTTP API）
 *
 * RESTART_GAME（任意状态 → unseated）
 * 服务端重置 state → postgres_changes 推送新状态到所有客户端。
 */
export async function restartGame(
  ctx: GameActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('restartGame called');

  const conn = getRoomCodeOrFail(ctx);
  if (!conn) return NOT_CONNECTED;
  const { roomCode } = conn;

  return callGameControlApi(
    '/api/game/restart',
    {
      roomCode,
    },
    ctx.store,
  );
}

/**
 * Host: 设置开牌动画（HTTP API）
 *
 * Host 在房间内选择开牌动画，所有玩家统一使用
 */
export async function setRoleRevealAnimation(
  ctx: GameActionsContext,
  animation: RoleRevealAnimation,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('setRoleRevealAnimation called', { animation });

  const conn = getRoomCodeOrFail(ctx);
  if (!conn) return NOT_CONNECTED;
  const { roomCode } = conn;

  return callGameControlApi(
    '/api/game/set-animation',
    {
      roomCode,
      animation,
    },
    ctx.store,
    // 乐观预测：立即更新动画设置
    (state) => ({ ...state, roleRevealAnimation: animation }),
  );
}

/**
 * Host: 分享「详细信息」给指定座位（HTTP API）
 *
 * ended 阶段 Host 选择允许查看夜晚行动详情的座位列表。
 */
export async function shareNightReview(
  ctx: GameActionsContext,
  allowedSeats: number[],
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('shareNightReview called', { allowedSeats });

  const conn = getRoomCodeOrFail(ctx);
  if (!conn) return NOT_CONNECTED;
  const { roomCode } = conn;

  return callGameControlApi(
    '/api/game/share-review',
    {
      roomCode,
      allowedSeats,
    },
    ctx.store,
  );
}

/**
 * 提交夜晚行动（HTTP API）
 *
 * Night-1 only. 成功后服务端自动评估并执行夜晚推进。
 */
export async function submitAction(
  ctx: GameActionsContext,
  seat: number,
  role: RoleId,
  target: number | null,
  extra?: unknown,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('submitAction called', { seat, role, target });

  const conn = getRoomCodeOrFail(ctx);
  if (!conn) return NOT_CONNECTED;
  const { roomCode } = conn;

  const result = await callGameControlApi(
    '/api/game/night/action',
    {
      roomCode,
      seat,
      role,
      target,
      extra,
    },
    ctx.store,
  );

  if (!result.success) {
    facadeLog.warn('submitAction failed', { reason: result.reason, seat, role, target });
    return { success: false, reason: result.reason };
  }

  return { success: true };
}

/**
 * 提交狼人投票（HTTP API）
 *
 * Night-1 only. 服务端内联推进自动处理 deadline + 步骤推进。
 */
export async function submitWolfVote(
  ctx: GameActionsContext,
  voterSeat: number,
  targetSeat: number,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('submitWolfVote called', { voterSeat, targetSeat });

  const conn = getRoomCodeOrFail(ctx);
  if (!conn) return NOT_CONNECTED;
  const { roomCode } = conn;

  const result = await callGameControlApi(
    '/api/game/night/wolf-vote',
    {
      roomCode,
      voterSeat,
      targetSeat,
    },
    ctx.store,
  );

  if (!result.success) {
    facadeLog.warn('submitWolfVote failed', {
      voterSeat,
      targetSeat,
      reason: result.reason,
    });
    return { success: false, reason: result.reason };
  }

  return { success: true };
}

/**
 * Host: 结束夜晚，进行死亡结算（HTTP API）
 *
 * 保留：作为手动触发 endNight 的 fallback。
 */
export async function endNight(
  ctx: GameActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('endNight called');

  const conn = getRoomCodeOrFail(ctx);
  if (!conn) return NOT_CONNECTED;
  const { roomCode } = conn;

  const result = await callGameControlApi(
    '/api/game/night/end',
    {
      roomCode,
    },
    ctx.store,
  );

  if (!result.success) {
    facadeLog.warn('endNight failed', { reason: result.reason });
    return { success: false, reason: result.reason };
  }

  return { success: true };
}

/**
 * Host: 设置音频播放状态（HTTP API）
 *
 * PR7: 音频时序控制
 * - 当音频开始播放时，调用 setAudioPlaying(true)
 * - 当音频结束（或被跳过）时，调用 setAudioPlaying(false)
 */
export async function setAudioPlaying(
  ctx: GameActionsContext,
  isPlaying: boolean,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('setAudioPlaying called', { isPlaying });

  const conn = getRoomCodeOrFail(ctx);
  if (!conn) return NOT_CONNECTED;
  const { roomCode } = conn;

  return callGameControlApi(
    '/api/game/night/audio-gate',
    {
      roomCode,
      isPlaying,
    },
    ctx.store,
  );
}

// =============================================================================
// Reveal Ack 处理
// =============================================================================

/**
 * Host: 清除 pending reveal acks 并推进夜晚（HTTP API）
 *
 * 当用户确认 reveal 弹窗后调用
 */
export async function clearRevealAcks(
  ctx: GameActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('clearRevealAcks called');

  const conn = getRoomCodeOrFail(ctx);
  if (!conn) return NOT_CONNECTED;
  const { roomCode } = conn;

  const result = await callGameControlApi(
    '/api/game/night/reveal-ack',
    {
      roomCode,
    },
    ctx.store,
  );

  if (!result.success) {
    facadeLog.warn('clearRevealAcks failed', { reason: result.reason });
    return { success: false, reason: result.reason };
  }

  return { success: true };
}

/**
 * Player: 提交 groupConfirm ack（HTTP API）
 *
 * 当所有玩家看到催眠确认提示后，每位玩家点击"我知道了"调用此方法。
 * 服务端收到所有玩家 ack 后自动推进夜晚步骤。
 */
export async function submitGroupConfirmAck(
  ctx: GameActionsContext,
  seat: number,
): Promise<{ success: boolean; reason?: string }> {
  const conn = getConnectionOrFail(ctx);
  if (!conn) return NOT_CONNECTED;
  const { roomCode, myUid } = conn;

  facadeLog.debug('submitGroupConfirmAck called', { seat });

  const result = await callGameControlApi(
    '/api/game/night/group-confirm-ack',
    { roomCode, seat, uid: myUid },
    ctx.store,
  );

  if (!result.success) {
    facadeLog.warn('submitGroupConfirmAck failed', { reason: result.reason, seat });
    return { success: false, reason: result.reason };
  }

  return { success: true };
}

/**
 * Host/Player: 设置机械狼查看猎人状态（HTTP API）
 *
 * 当机械狼学到猎人后查看状态按钮被点击时调用
 */
export async function setWolfRobotHunterStatusViewed(
  ctx: GameActionsContext,
  seat: number,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('setWolfRobotHunterStatusViewed called', { seat });

  const conn = getRoomCodeOrFail(ctx);
  if (!conn) return NOT_CONNECTED;
  const { roomCode } = conn;

  const result = await callGameControlApi(
    '/api/game/night/wolf-robot-viewed',
    {
      roomCode,
      seat,
    },
    ctx.store,
  );

  if (!result.success) {
    facadeLog.warn('setWolfRobotHunterStatusViewed failed', { reason: result.reason, seat });
    return { success: false, reason: result.reason };
  }

  return { success: true };
}

// =============================================================================
// Audio Ack & Progression（音频确认 + 手动推进触发）
// =============================================================================

/**
 * Host: 音频播放完毕后确认（HTTP API）
 *
 * 客户端播放完 pendingAudioEffects 后调用。
 * 服务端清除 effects + isAudioPlaying，然后执行内联推进。
 */
export async function postAudioAck(
  ctx: GameActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('postAudioAck called');

  const conn = getRoomCodeOrFail(ctx);
  if (!conn) return NOT_CONNECTED;
  const { roomCode } = conn;

  return callGameControlApi(
    '/api/game/night/audio-ack',
    {
      roomCode,
    },
    ctx.store,
  );
}

/**
 * Host: 触发服务端推进（HTTP API）
 *
 * 用于 wolf vote deadline 到期时客户端触发推进。
 * 服务端执行内联推进（evaluate + advance/endNight 循环）。
 */
export async function postProgression(
  ctx: GameActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('postProgression called');

  const conn = getRoomCodeOrFail(ctx);
  if (!conn) return NOT_CONNECTED;
  const { roomCode } = conn;

  return callGameControlApi(
    '/api/game/night/progression',
    {
      roomCode,
    },
    ctx.store,
  );
}

// =============================================================================
// Debug Mode: Fill With Bots（调试模式：填充机器人）
// =============================================================================

/**
 * Host: 填充机器人（Debug-only, HTTP API）
 *
 * 为所有空座位创建 bot player，设置 debugMode.botsEnabled = true。
 * 仅在 status === Unseated 时可用。
 */
export async function fillWithBots(
  ctx: GameActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  const conn = getRoomCodeOrFail(ctx);
  if (!conn) return NOT_CONNECTED;
  const { roomCode } = conn;

  return callGameControlApi(
    '/api/game/fill-bots',
    {
      roomCode,
    },
    ctx.store,
  );
}

/**
 * Host: 标记所有机器人已查看角色（Debug-only, HTTP API）
 *
 * 仅对 isBot === true 的玩家设置 hasViewedRole = true。
 * 仅在 debugMode.botsEnabled === true && status === Assigned 时可用。
 */
export async function markAllBotsViewed(
  ctx: GameActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  const conn = getRoomCodeOrFail(ctx);
  if (!conn) return NOT_CONNECTED;
  const { roomCode } = conn;

  return callGameControlApi(
    '/api/game/mark-bots-viewed',
    {
      roomCode,
    },
    ctx.store,
  );
}

// =============================================================================
// Clear All Seats（全员起立）
// =============================================================================

/**
 * Host: 全员起立（HTTP API）
 *
 * 清空所有已入座玩家。仅在 status === Unseated | Seated 时可用。
 */
export async function clearAllSeats(
  ctx: GameActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  const conn = getRoomCodeOrFail(ctx);
  if (!conn) return NOT_CONNECTED;
  const { roomCode } = conn;

  return callGameControlApi(
    '/api/game/clear-seats',
    {
      roomCode,
    },
    ctx.store,
  );
}
