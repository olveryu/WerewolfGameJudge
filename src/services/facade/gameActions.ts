/**
 * Game Actions — 游戏 HTTP API 业务编排（声明式）
 *
 * 使用 defineGameAction 工厂将原本手动的 debug-log → guard → callApi 模式
 * 替换为声明式定义。每个动作只声明 name / path / 可选的 body / after。
 *
 * 职责同 defineGameAction.ts。
 * 禁止：业务逻辑/校验规则（全部在 handler / 服务端），直接修改 state。
 */

import type { GameStore } from '@werewolf/game-engine/engine/store';
import type { RoleId } from '@werewolf/game-engine/models/roles';
import type { GameTemplate } from '@werewolf/game-engine/models/Template';

import type { AudioService } from '@/services/infra/AudioService';
import { facadeLog } from '@/utils/logger';

import { defineGameAction } from './defineGameAction';

/**
 * gameActions 依赖的上下文接口
 * （从 Facade 注入，避免循环依赖）
 */
export interface GameActionsContext {
  readonly store: GameStore;
  myUserId: string | null;
  getMySeat: () => number | null;
  /** AudioService 实例（用于 preload 等直接调用） */
  audioService: AudioService;
}

// =============================================================================
// Host-only: 房间 / 模板管理
// =============================================================================

/** Host: 分配角色 */
export const assignRoles = defineGameAction({
  name: 'assignRoles',
  path: '/game/assign',
});

/** Host: 更新模板 */
export const updateTemplate = defineGameAction<[GameTemplate]>({
  name: 'updateTemplate',
  path: '/game/update-template',
  body: (template) => ({ templateRoles: template.roles }),
});

/** Host: 重新开始游戏 */
export const restartGame = defineGameAction({
  name: 'restartGame',
  path: '/game/restart',
});

/** Host: 全员起立 */
export const clearAllSeats = defineGameAction({
  name: 'clearAllSeats',
  path: '/game/clear-seats',
});

// =============================================================================
// 角色查看
// =============================================================================

/** Host/Player: 标记某座位已查看角色 */
export const markViewedRole = defineGameAction<[number]>({
  name: 'markViewedRole',
  path: '/game/view-role',
  needsUserId: true,
  body: (seat) => ({ seat }),
});

// =============================================================================
// 夜晚流程
// =============================================================================

/** Host: 开始夜晚（成功后 preload 音频） */
export const startNight = defineGameAction({
  name: 'startNight',
  path: '/game/start',
  after: (ctx, result) => {
    if (!result.success) return;
    const stateAfterStart = ctx.store.getState();
    if (stateAfterStart?.templateRoles) {
      ctx.audioService.preloadForRoles(stateAfterStart.templateRoles).catch((err: unknown) => {
        facadeLog.warn('preloadForRoles failed (non-critical)', err);
      });
    }
  },
});

/** Host: 分享夜晚详情给指定座位 */
export const shareNightReview = defineGameAction<[number[]]>({
  name: 'shareNightReview',
  path: '/game/share-review',
  body: (allowedSeats) => ({ allowedSeats }),
});

/** 提交夜晚行动 */
export const submitAction = defineGameAction<[number, RoleId, number | null, unknown?]>({
  name: 'submitAction',
  path: '/game/night/action',
  body: (seat, role, target, extra) => ({ seat, role, target, extra }),
  after: (_ctx, result, seat, role, target) => {
    if (!result.success) {
      facadeLog.warn('submitAction failed', { reason: result.reason, seat, role, target });
    }
  },
});

/** Host: 设置音频播放状态 */
export const setAudioPlaying = defineGameAction<[boolean]>({
  name: 'setAudioPlaying',
  path: '/game/night/audio-gate',
  body: (isPlaying) => ({ isPlaying }),
});

// =============================================================================
// Reveal / Group-Confirm Ack
// =============================================================================

/** Host: 清除 pending reveal acks 并推进 */
export const clearRevealAcks = defineGameAction({
  name: 'clearRevealAcks',
  path: '/game/night/reveal-ack',
  after: (_ctx, result) => {
    if (!result.success) {
      facadeLog.warn('clearRevealAcks failed', { reason: result.reason });
    }
  },
});

/** Player: 提交 groupConfirm ack */
export const submitGroupConfirmAck = defineGameAction<[number]>({
  name: 'submitGroupConfirmAck',
  path: '/game/night/group-confirm-ack',
  needsUserId: true,
  body: (seat) => ({ seat }),
  after: (_ctx, result, seat) => {
    if (!result.success) {
      facadeLog.warn('submitGroupConfirmAck failed', { reason: result.reason, seat });
    }
  },
});

/** Host/Player: 机械狼人查看猎人状态 */
export const setWolfRobotHunterStatusViewed = defineGameAction<[number]>({
  name: 'setWolfRobotHunterStatusViewed',
  path: '/game/night/wolf-robot-viewed',
  body: (seat) => ({ seat }),
  after: (_ctx, result, seat) => {
    if (!result.success) {
      facadeLog.warn('setWolfRobotHunterStatusViewed failed', { reason: result.reason, seat });
    }
  },
});

// =============================================================================
// Audio Ack & Progression
// =============================================================================

/** Host: 音频播放完毕后确认 */
export const postAudioAck = defineGameAction({
  name: 'postAudioAck',
  path: '/game/night/audio-ack',
});

/** Host: 触发服务端推进 */
export const postProgression = defineGameAction({
  name: 'postProgression',
  path: '/game/night/progression',
});

// =============================================================================
// Debug Mode
// =============================================================================

/** Host: 填充机器人（Debug-only） */
export const fillWithBots = defineGameAction({
  name: 'fillWithBots',
  path: '/game/fill-bots',
});

/** Host: 标记所有机器人已查看角色（Debug-only） */
export const markAllBotsViewed = defineGameAction({
  name: 'markAllBotsViewed',
  path: '/game/mark-bots-viewed',
});

/** Host: 标记所有机器人已确认 groupConfirm 步骤（Debug-only） */
export const markAllBotsGroupConfirmed = defineGameAction({
  name: 'markAllBotsGroupConfirmed',
  path: '/game/night/mark-bots-group-confirmed',
});

// =============================================================================
// 玩家资料同步
// =============================================================================

/** 同步玩家资料到 GameState（任何在座玩家） */
export const updatePlayerProfile = defineGameAction<
  [string?, string?, string?, string?, string?, string?, string?]
>({
  name: 'updatePlayerProfile',
  path: '/game/update-profile',
  needsUserId: true,
  body: (
    displayName,
    avatarUrl,
    avatarFrame,
    seatFlair,
    nameStyle,
    roleRevealEffect,
    seatAnimation,
  ) => ({
    displayName,
    avatarUrl,
    avatarFrame,
    seatFlair,
    nameStyle,
    roleRevealEffect,
    seatAnimation,
  }),
});

// =============================================================================
// 板子建议
// =============================================================================

/** 提交板子建议（任意已连接玩家，每人最多一条） */
export const boardNominate = defineGameAction<[string, RoleId[]]>({
  name: 'boardNominate',
  path: '/game/board-nominate',
  needsUserId: true,
  body: (displayName, roles) => ({ displayName, roles }),
});

/** 点赞板子建议（任意已连接玩家） */
export const boardUpvote = defineGameAction<[string]>({
  name: 'boardUpvote',
  path: '/game/board-upvote',
  needsUserId: true,
  body: (targetUserId) => ({ targetUserId }),
});

/** 撤回板子建议（仅提交者本人） */
export const boardWithdraw = defineGameAction({
  name: 'boardWithdraw',
  path: '/game/board-withdraw',
  needsUserId: true,
});
