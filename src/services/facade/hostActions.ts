/**
 * Host Actions - Host-only 业务编排
 *
 * 拆分自 GameFacade.ts（纯重构 PR，无行为变更）
 *
 * 职责：
 * - Host-only 游戏控制方法（assignRoles/markViewedRole/startNight）→ HTTP API
 * - Host-only 夜晚行动方法（submitAction/submitWolfVote）→ HTTP API
 * - 夜晚控制（endNight/setAudioPlaying/postAudioAck/postProgression）→ HTTP API
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
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';
import type { RoleRevealAnimation } from '@werewolf/game-engine/types/RoleRevealAnimation';
import { secureRng } from '@werewolf/game-engine/utils/random';

import { API_BASE_URL } from '@/config/api';
import type { AudioService } from '@/services/infra/AudioService';
import { facadeLog } from '@/utils/logger';

/**
 * Host Actions 依赖的上下文接口
 * （从 Facade 注入，避免循环依赖）
 */
export interface HostActionsContext {
  readonly store: GameStore;
  myUid: string | null;
  getMySeatNumber: () => number | null;
  /** AudioService 实例（用于 preload 等直接调用） */
  audioService: AudioService;
}

// =============================================================================
// Game Control API (HTTP — Phase 2)
// =============================================================================

/** Game Control API 响应 */
interface GameControlApiResponse {
  success: boolean;
  reason?: string;
  state?: Record<string, unknown>;
  revision?: number;
}

/**
 * 调用 Game Control API（内置客户端重试）
 *
 * 服务端乐观锁冲突返回 CONFLICT_RETRY 时，客户端透明重试（最多 2 次），
 * 配合服务端 3 次重试，有效重试上限为 3×3 = 9 次。
 */
async function callGameControlApi(
  path: string,
  body: Record<string, unknown>,
  store?: GameStore,
): Promise<GameControlApiResponse> {
  const MAX_CLIENT_RETRIES = 2;

  for (let attempt = 0; attempt <= MAX_CLIENT_RETRIES; attempt++) {
    try {
      const res = await fetch(`${API_BASE_URL}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = (await res.json()) as GameControlApiResponse;

      // 乐观锁冲突 → 客户端透明重试（退避 + 随机抖动）
      if (result.reason === 'CONFLICT_RETRY' && attempt < MAX_CLIENT_RETRIES) {
        const delay = 100 * (attempt + 1) + secureRng() * 50;
        facadeLog.warn('CONFLICT_RETRY, client retrying', { path, attempt: attempt + 1 });
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }

      // Optimistic Response: HTTP 响应含 state 时立即 apply，不等 broadcast
      if (result.success && result.state && result.revision != null && store) {
        store.applySnapshot(result.state as never, result.revision);
      }

      return result;
    } catch (e) {
      const err = e as { message?: string };
      facadeLog.error('callGameControlApi failed', { path, error: err?.message ?? String(e) });
      return { success: false, reason: 'NETWORK_ERROR' };
    }
  }

  // TypeScript exhaustiveness — 不应到达此处
  return { success: false, reason: 'CONFLICT_RETRY' };
}

/**
 * Host: 分配角色（HTTP API）
 */
export async function assignRoles(
  ctx: HostActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('assignRoles called');

  const roomCode = ctx.store.getState()?.roomCode;
  if (!roomCode || !ctx.myUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  return callGameControlApi(
    '/api/game/assign',
    {
      roomCode,
      hostUid: ctx.myUid,
    },
    ctx.store,
  );
}

/**
 * Host/Player: 标记某座位已查看角色（HTTP API）
 */
export async function markViewedRole(
  ctx: HostActionsContext,
  seat: number,
): Promise<{ success: boolean; reason?: string }> {
  const roomCode = ctx.store.getState()?.roomCode;
  if (!roomCode || !ctx.myUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  const result = await callGameControlApi(
    '/api/game/view-role',
    {
      roomCode,
      uid: ctx.myUid,
      seat,
    },
    ctx.store,
  );
  return result;
}

/**
 * Host: 开始夜晚（HTTP API）
 *
 * ready → ongoing. 音频 sideEffects 由客户端按序播放。
 */
export async function startNight(
  ctx: HostActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('startNight called');

  const roomCode = ctx.store.getState()?.roomCode;
  if (!roomCode || !ctx.myUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  const result = await callGameControlApi(
    '/api/game/start',
    {
      roomCode,
      hostUid: ctx.myUid,
    },
    ctx.store,
  );

  if (!result.success) {
    return result;
  }

  // Fire-and-forget: preload audio for all template roles before night flow starts.
  const stateAfterStart = ctx.store.getState();
  if (stateAfterStart?.templateRoles) {
    ctx.audioService.preloadForRoles(stateAfterStart.templateRoles as RoleId[]).catch(() => {
      // Preload failure is non-critical; normal playback will still work.
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
  ctx: HostActionsContext,
  template: GameTemplate,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('updateTemplate called');

  const roomCode = ctx.store.getState()?.roomCode;
  if (!roomCode || !ctx.myUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  return callGameControlApi(
    '/api/game/update-template',
    {
      roomCode,
      hostUid: ctx.myUid,
      templateRoles: template.roles,
    },
    ctx.store,
  );
}

/**
 * Host: 重新开始游戏（HTTP API）
 *
 * RESTART_GAME（任意状态 → unseated）
 * 服务端会先广播 GAME_RESTARTED，再变更 state。
 */
export async function restartGame(
  ctx: HostActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('restartGame called');

  const roomCode = ctx.store.getState()?.roomCode;
  if (!roomCode || !ctx.myUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  return callGameControlApi(
    '/api/game/restart',
    {
      roomCode,
      hostUid: ctx.myUid,
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
  ctx: HostActionsContext,
  animation: RoleRevealAnimation,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('setRoleRevealAnimation called', { animation });

  const roomCode = ctx.store.getState()?.roomCode;
  if (!roomCode || !ctx.myUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  return callGameControlApi(
    '/api/game/set-animation',
    {
      roomCode,
      hostUid: ctx.myUid,
      animation,
    },
    ctx.store,
  );
}

/**
 * Host: 处理玩家提交的夜晚行动（HTTP API）
 *
 * Night-1 only. 成功后自动评估并执行夜晚推进。
 */
export async function submitAction(
  ctx: HostActionsContext,
  seat: number,
  role: RoleId,
  target: number | null,
  extra?: unknown,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('submitAction called', { seat, role, target });

  const roomCode = ctx.store.getState()?.roomCode;
  const hostUid = ctx.store.getState()?.hostUid;
  if (!roomCode || !hostUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  const result = await callGameControlApi(
    '/api/game/night/action',
    {
      roomCode,
      hostUid,
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
 * Host: 处理狼人投票（HTTP API）
 *
 * Night-1 only. 服务端内联推进自动处理 deadline + 步骤推进。
 */
export async function submitWolfVote(
  ctx: HostActionsContext,
  voterSeat: number,
  targetSeat: number,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('submitWolfVote called', { voterSeat, targetSeat });

  const roomCode = ctx.store.getState()?.roomCode;
  const hostUid = ctx.store.getState()?.hostUid;
  if (!roomCode || !hostUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  const result = await callGameControlApi(
    '/api/game/night/wolf-vote',
    {
      roomCode,
      hostUid,
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
  ctx: HostActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('endNight called');

  const roomCode = ctx.store.getState()?.roomCode;
  const hostUid = ctx.store.getState()?.hostUid;
  if (!roomCode || !hostUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  const result = await callGameControlApi(
    '/api/game/night/end',
    {
      roomCode,
      hostUid,
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
  ctx: HostActionsContext,
  isPlaying: boolean,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('setAudioPlaying called', { isPlaying });

  const roomCode = ctx.store.getState()?.roomCode;
  const hostUid = ctx.store.getState()?.hostUid;
  if (!roomCode || !hostUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  return callGameControlApi(
    '/api/game/night/audio-gate',
    {
      roomCode,
      hostUid,
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
  ctx: HostActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('clearRevealAcks called');

  const roomCode = ctx.store.getState()?.roomCode;
  const hostUid = ctx.store.getState()?.hostUid;
  if (!roomCode || !hostUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  const result = await callGameControlApi(
    '/api/game/night/reveal-ack',
    {
      roomCode,
      hostUid,
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
 * Host/Player: 设置机械狼查看猎人状态（HTTP API）
 *
 * 当机械狼学到猎人后查看状态按钮被点击时调用
 */
export async function setWolfRobotHunterStatusViewed(
  ctx: HostActionsContext,
  seat: number,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('setWolfRobotHunterStatusViewed called', { seat });

  const roomCode = ctx.store.getState()?.roomCode;
  const hostUid = ctx.store.getState()?.hostUid;
  if (!roomCode || !hostUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  const result = await callGameControlApi(
    '/api/game/night/wolf-robot-viewed',
    {
      roomCode,
      hostUid,
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
  ctx: HostActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('postAudioAck called');

  const roomCode = ctx.store.getState()?.roomCode;
  const hostUid = ctx.store.getState()?.hostUid;
  if (!roomCode || !hostUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  return callGameControlApi(
    '/api/game/night/audio-ack',
    {
      roomCode,
      hostUid,
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
  ctx: HostActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('postProgression called');

  const roomCode = ctx.store.getState()?.roomCode;
  const hostUid = ctx.store.getState()?.hostUid;
  if (!roomCode || !hostUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  return callGameControlApi(
    '/api/game/night/progression',
    {
      roomCode,
      hostUid,
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
 * 仅在 status === 'unseated' 时可用。
 */
export async function fillWithBots(
  ctx: HostActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  const roomCode = ctx.store.getState()?.roomCode;
  if (!roomCode || !ctx.myUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  return callGameControlApi(
    '/api/game/fill-bots',
    {
      roomCode,
      hostUid: ctx.myUid,
    },
    ctx.store,
  );
}

/**
 * Host: 标记所有机器人已查看角色（Debug-only, HTTP API）
 *
 * 仅对 isBot === true 的玩家设置 hasViewedRole = true。
 * 仅在 debugMode.botsEnabled === true && status === 'assigned' 时可用。
 */
export async function markAllBotsViewed(
  ctx: HostActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  const roomCode = ctx.store.getState()?.roomCode;
  if (!roomCode || !ctx.myUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  return callGameControlApi(
    '/api/game/mark-bots-viewed',
    {
      roomCode,
      hostUid: ctx.myUid,
    },
    ctx.store,
  );
}
