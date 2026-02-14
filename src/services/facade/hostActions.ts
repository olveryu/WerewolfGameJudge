/**
 * Host Actions - Host-only 业务编排
 *
 * 拆分自 GameFacade.ts（纯重构 PR，无行为变更）
 *
 * 职责：
 * - Host-only 游戏控制方法（assignRoles/markViewedRole/startNight）→ HTTP API
 * - Host-only 夜晚行动方法（submitAction/submitWolfVote）→ HTTP API
 * - 夜晚推进 & 音频编排（advanceNight/endNight/setAudioPlaying/callNightProgression）→ HTTP API
 *
 * 禁止：
 * - 业务逻辑/校验规则（全部在 handler / 服务端）
 * - 直接修改 state（全部在 reducer / 服务端）
 */

import { API_BASE_URL } from '@/config/api';
import type { RoleId } from '@/models/roles';
import type { GameTemplate } from '@/models/Template';
import { WOLF_VOTE_COUNTDOWN_MS } from '@/services/engine/handlers/progressionEvaluator';
import type { SideEffect } from '@/services/engine/handlers/types';
import type { GameStore } from '@/services/engine/store';
import type { AudioService } from '@/services/infra/AudioService';
import type { RoleRevealAnimation } from '@/types/RoleRevealAnimation';
import { facadeLog } from '@/utils/logger';

/**
 * Host Actions 依赖的上下文接口
 * （从 Facade 注入，避免循环依赖）
 */
export interface HostActionsContext {
  readonly store: GameStore;
  isHost: boolean;
  myUid: string | null;
  getMySeatNumber: () => number | null;
  broadcastCurrentState: () => Promise<void>;
  /**
   * Abort check: returns true if room has been left.
   * Used by processHandlerResult to stop audio queue when leaving room.
   */
  isAborted?: () => boolean;
  /**
   * P0-1/P0-5 修复: 音频播放回调
   * @param audioKey - 'night' | 'night_end' | RoleId
   * @param isEndAudio - 如果为 true，使用 audio_end 目录
   */
  playAudio?: (audioKey: string, isEndAudio?: boolean) => Promise<void>;
  /**
   * 设置音频播放状态（Audio Gate）
   * 根据 copilot-instructions.md：音频播放前设 true，结束后设 false
   */
  setAudioPlayingGate?: (isPlaying: boolean) => Promise<void>;
  /**
   * 狼人投票倒计时 Timer 引用
   * 由 submitWolfVote 管理：set / clear / 在 leaveRoom 时清除
   */
  wolfVoteTimer: ReturnType<typeof setTimeout> | null;
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
  sideEffects?: SideEffect[];
}

/**
 * 调用 Game Control API
 */
async function callGameControlApi(
  path: string,
  body: Record<string, unknown>,
): Promise<GameControlApiResponse> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    return (await res.json()) as GameControlApiResponse;
  } catch (e) {
    const err = e as { message?: string };
    facadeLog.error('callGameControlApi failed', { path, error: err?.message ?? String(e) });
    return { success: false, reason: 'NETWORK_ERROR' };
  }
}

/**
 * 播放 API 返回的 PLAY_AUDIO sideEffects（客户端音频编排）
 */
async function playApiSideEffects(
  ctx: HostActionsContext,
  sideEffects: SideEffect[] | undefined,
): Promise<void> {
  const audioEffects =
    sideEffects?.filter(
      (e): e is { type: 'PLAY_AUDIO'; audioKey: string; isEndAudio?: boolean } =>
        e.type === 'PLAY_AUDIO',
    ) ?? [];

  if (audioEffects.length === 0 || !ctx.playAudio) return;

  if (ctx.setAudioPlayingGate) {
    await ctx.setAudioPlayingGate(true);
  }

  try {
    for (const effect of audioEffects) {
      if (ctx.isAborted?.()) {
        facadeLog.debug('playApiSideEffects: aborted, skipping remaining audio');
        break;
      }
      await ctx.playAudio(effect.audioKey, effect.isEndAudio);
    }
  } finally {
    if (ctx.setAudioPlayingGate && !ctx.isAborted?.()) {
      await ctx.setAudioPlayingGate(false);
    }
  }
}

/**
 * Host: 分配角色（HTTP API）
 */
export async function assignRoles(
  ctx: HostActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('assignRoles called', { isHost: ctx.isHost });

  const roomCode = ctx.store.getState()?.roomCode;
  if (!roomCode || !ctx.myUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  return callGameControlApi('/api/game/assign', {
    roomCode,
    hostUid: ctx.myUid,
  });
}

/**
 * Host/Player: 标记某座位已查看角色（HTTP API）
 */
export async function markViewedRole(
  ctx: HostActionsContext,
  seat: number,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('markViewedRole called', { seat, isHost: ctx.isHost });

  const roomCode = ctx.store.getState()?.roomCode;
  if (!roomCode || !ctx.myUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  return callGameControlApi('/api/game/view-role', {
    roomCode,
    uid: ctx.myUid,
    seat,
  });
}

/**
 * Host: 开始夜晚（HTTP API）
 *
 * ready → ongoing. 音频 sideEffects 由客户端按序播放。
 */
export async function startNight(
  ctx: HostActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('startNight called', { isHost: ctx.isHost });

  const roomCode = ctx.store.getState()?.roomCode;
  if (!roomCode || !ctx.myUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  const result = await callGameControlApi('/api/game/start', {
    roomCode,
    hostUid: ctx.myUid,
  });

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

  // 播放服务端返回的音频 sideEffects（夜晚开始音频 + 第一步音频）
  await playApiSideEffects(ctx, result.sideEffects);

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
  facadeLog.debug('updateTemplate called', { isHost: ctx.isHost });

  const roomCode = ctx.store.getState()?.roomCode;
  if (!roomCode || !ctx.myUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  return callGameControlApi('/api/game/update-template', {
    roomCode,
    hostUid: ctx.myUid,
    templateRoles: template.roles,
  });
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
  facadeLog.debug('restartGame called', { isHost: ctx.isHost });

  const roomCode = ctx.store.getState()?.roomCode;
  if (!roomCode || !ctx.myUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  return callGameControlApi('/api/game/restart', {
    roomCode,
    hostUid: ctx.myUid,
  });
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
  facadeLog.debug('setRoleRevealAnimation called', { isHost: ctx.isHost, animation });

  const roomCode = ctx.store.getState()?.roomCode;
  if (!roomCode || !ctx.myUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  return callGameControlApi('/api/game/set-animation', {
    roomCode,
    hostUid: ctx.myUid,
    animation,
  });
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
  facadeLog.debug('submitAction called', { seat, role, target, isHost: ctx.isHost });

  const roomCode = ctx.store.getState()?.roomCode;
  const hostUid = ctx.store.getState()?.hostUid;
  if (!roomCode || !hostUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  const result = await callGameControlApi('/api/game/night/action', {
    roomCode,
    hostUid,
    seat,
    role,
    target,
    extra,
  });

  if (!result.success) {
    facadeLog.warn('submitAction failed', { reason: result.reason, seat, role, target });
    return { success: false, reason: result.reason };
  }

  // 播放服务端返回的音频 sideEffects
  await playApiSideEffects(ctx, result.sideEffects);

  // Host-only 自动推进
  if (ctx.isHost) {
    await callNightProgression(ctx);
  }

  return { success: true };
}

/**
 * Host: 处理狼人投票（HTTP API）
 *
 * Night-1 only. 成功后管理本地 wolf vote timer + 自动推进。
 */
export async function submitWolfVote(
  ctx: HostActionsContext,
  voterSeat: number,
  targetSeat: number,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('submitWolfVote called', { voterSeat, targetSeat, isHost: ctx.isHost });

  const roomCode = ctx.store.getState()?.roomCode;
  const hostUid = ctx.store.getState()?.hostUid;
  if (!roomCode || !hostUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  const result = await callWolfVoteApi(roomCode, hostUid, voterSeat, targetSeat);

  if (!result.success) {
    facadeLog.warn('submitWolfVote failed', {
      voterSeat,
      targetSeat,
      reason: result.reason,
    });
    return { success: false, reason: result.reason };
  }

  // 播放服务端返回的音频 sideEffects
  await playApiSideEffects(ctx, result.sideEffects);

  // Host-only: wolf vote timer + 推进
  if (ctx.isHost) {
    const wolfVoteTimer = result.wolfVoteTimer as 'set' | 'clear' | 'noop' | undefined;

    switch (wolfVoteTimer) {
      case 'set': {
        if (ctx.wolfVoteTimer != null) clearTimeout(ctx.wolfVoteTimer);
        ctx.wolfVoteTimer = setTimeout(async () => {
          ctx.wolfVoteTimer = null;
          if (!ctx.isAborted?.()) await callNightProgression(ctx);
        }, WOLF_VOTE_COUNTDOWN_MS);
        break;
      }
      case 'clear': {
        if (ctx.wolfVoteTimer != null) clearTimeout(ctx.wolfVoteTimer);
        ctx.wolfVoteTimer = null;
        break;
      }
      // noop: do nothing
    }

    await callNightProgression(ctx);
  }

  return { success: true };
}

/**
 * Wolf Vote API 专用调用（响应含 wolfVoteTimer 字段）
 */
async function callWolfVoteApi(
  roomCode: string,
  hostUid: string,
  voterSeat: number,
  targetSeat: number,
): Promise<GameControlApiResponse & { wolfVoteTimer?: string }> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/game/night/wolf-vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode, hostUid, voterSeat, targetSeat }),
    });
    return (await res.json()) as GameControlApiResponse & { wolfVoteTimer?: string };
  } catch (e) {
    const err = e as { message?: string };
    facadeLog.error('callWolfVoteApi failed', { error: err?.message ?? String(e) });
    return { success: false, reason: 'NETWORK_ERROR' };
  }
}

/**
 * Host: 推进夜晚到下一步（HTTP API）
 *
 * PR6: ADVANCE_NIGHT（音频结束后调用）
 */
export async function advanceNight(
  ctx: HostActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('advanceNight called', { isHost: ctx.isHost });

  const roomCode = ctx.store.getState()?.roomCode;
  const hostUid = ctx.store.getState()?.hostUid;
  if (!roomCode || !hostUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  const result = await callGameControlApi('/api/game/night/advance', {
    roomCode,
    hostUid,
  });

  if (!result.success) {
    facadeLog.warn('advanceNight failed', { reason: result.reason });
    return { success: false, reason: result.reason };
  }

  // 播放服务端返回的音频 sideEffects
  await playApiSideEffects(ctx, result.sideEffects);

  return { success: true };
}

/**
 * Host: 结束夜晚，进行死亡结算（HTTP API）
 *
 * PR6: END_NIGHT（夜晚结束音频结束后调用）
 */
export async function endNight(
  ctx: HostActionsContext,
): Promise<{ success: boolean; reason?: string }> {
  facadeLog.debug('endNight called', { isHost: ctx.isHost });

  const roomCode = ctx.store.getState()?.roomCode;
  const hostUid = ctx.store.getState()?.hostUid;
  if (!roomCode || !hostUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  const result = await callGameControlApi('/api/game/night/end', {
    roomCode,
    hostUid,
  });

  if (!result.success) {
    facadeLog.warn('endNight failed', { reason: result.reason });
    return { success: false, reason: result.reason };
  }

  // 播放服务端返回的音频 sideEffects
  await playApiSideEffects(ctx, result.sideEffects);

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
  facadeLog.debug('setAudioPlaying called', { isPlaying, isHost: ctx.isHost });

  const roomCode = ctx.store.getState()?.roomCode;
  const hostUid = ctx.store.getState()?.hostUid;
  if (!roomCode || !hostUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  return callGameControlApi('/api/game/night/audio-gate', {
    roomCode,
    hostUid,
    isPlaying,
  });
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
  facadeLog.debug('clearRevealAcks called', { isHost: ctx.isHost });

  const roomCode = ctx.store.getState()?.roomCode;
  const hostUid = ctx.store.getState()?.hostUid;
  if (!roomCode || !hostUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  const result = await callGameControlApi('/api/game/night/reveal-ack', {
    roomCode,
    hostUid,
  });

  if (!result.success) {
    facadeLog.warn('clearRevealAcks failed', { reason: result.reason });
    return { success: false, reason: result.reason };
  }

  // 推进夜晚流程
  await callNightProgression(ctx);

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
  facadeLog.debug('setWolfRobotHunterStatusViewed called', { isHost: ctx.isHost, seat });

  const roomCode = ctx.store.getState()?.roomCode;
  const hostUid = ctx.store.getState()?.hostUid;
  if (!roomCode || !hostUid) {
    return { success: false, reason: 'NOT_CONNECTED' };
  }

  const result = await callGameControlApi('/api/game/night/wolf-robot-viewed', {
    roomCode,
    hostUid,
    seat,
  });

  if (!result.success) {
    facadeLog.warn('setWolfRobotHunterStatusViewed failed', { reason: result.reason, seat });
    return { success: false, reason: result.reason };
  }

  // 推进夜晚流程（gate 解除后自动推进到下一步）
  await callNightProgression(ctx);

  return { success: true };
}

// =============================================================================
// 夜晚推进透传（调用 handler 层的 handleNightProgression）
// =============================================================================

/**
 * Host: HTTP-driven 夜晚推进循环
 *
 * 1. POST /api/game/night/progression → { decision }
 * 2. if advance → POST /api/game/night/advance → { sideEffects } → playApiSideEffects → recurse
 * 3. if end_night → POST /api/game/night/end → { sideEffects } → playApiSideEffects
 * 4. if none → done
 *
 * Exported：Facade foreground recovery 需要调用此方法。
 */
export async function callNightProgression(ctx: HostActionsContext): Promise<void> {
  const roomCode = ctx.store.getState()?.roomCode;
  const hostUid = ctx.store.getState()?.hostUid;
  if (!roomCode || !hostUid) return;

  // 防止离开房间后继续推进
  if (ctx.isAborted?.()) return;

  const progResult = await callGameControlApi('/api/game/night/progression', {
    roomCode,
    hostUid,
  });

  if (!progResult.success) {
    facadeLog.warn('callNightProgression: progression API failed', {
      reason: progResult.reason,
    });
    return;
  }

  const decision = (progResult as unknown as Record<string, unknown>).decision as
    | string
    | undefined;
  const reason = (progResult as unknown as Record<string, unknown>).reason as string | undefined;

  facadeLog.debug('callNightProgression: decision', { decision, reason });

  switch (decision) {
    case 'advance': {
      if (ctx.isAborted?.()) return;
      const advResult = await callGameControlApi('/api/game/night/advance', {
        roomCode,
        hostUid,
      });
      if (advResult.success) {
        await playApiSideEffects(ctx, advResult.sideEffects);
        // 递归：推进后继续评估（可能连续跳步）
        await callNightProgression(ctx);
      } else {
        facadeLog.warn('callNightProgression: advance failed', { reason: advResult.reason });
      }
      break;
    }

    case 'end_night': {
      if (ctx.isAborted?.()) return;
      const endResult = await callGameControlApi('/api/game/night/end', {
        roomCode,
        hostUid,
      });
      if (endResult.success) {
        await playApiSideEffects(ctx, endResult.sideEffects);
      } else {
        facadeLog.warn('callNightProgression: end_night failed', { reason: endResult.reason });
      }
      break;
    }

    case 'none':
    default:
      // 无需推进
      break;
  }
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

  return callGameControlApi('/api/game/fill-bots', {
    roomCode,
    hostUid: ctx.myUid,
  });
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

  return callGameControlApi('/api/game/mark-bots-viewed', {
    roomCode,
    hostUid: ctx.myUid,
  });
}
