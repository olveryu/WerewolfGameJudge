/**
 * Step Transition Guards - 夜晚步骤切换前置条件验证
 *
 * 纯函数模块，负责：
 * - ADVANCE_NIGHT / END_NIGHT 共用 gate 验证
 * - SET_AUDIO_PLAYING 专用 gate 验证
 *
 * Gate 不含 IO，不修改 state。
 */

import { GameStatus } from '../../models';
import type { HandlerContext, HandlerResult, NonNullState } from './types';

/**
 * 验证前置条件（ADVANCE_NIGHT / END_NIGHT 共用）
 *
 * Gate 顺序：
 * 1. no_state
 * 2. invalid_status (must be ongoing)
 * 3. forbidden_while_audio_playing
 * 4. wolfrobot_hunter_status_not_viewed (if learned hunter but not viewed)
 */
export function validateNightFlowPreconditions(
  context: HandlerContext,
): { valid: false; result: HandlerResult } | { valid: true; state: NonNullState } {
  const { state } = context;

  // Gate 1: no_state
  if (!state) {
    return {
      valid: false,
      result: { success: false, reason: 'no_state', actions: [] },
    };
  }

  // Gate 2: invalid_status (must be ongoing)
  if (state.status !== GameStatus.Ongoing) {
    return {
      valid: false,
      result: { success: false, reason: 'invalid_status', actions: [] },
    };
  }

  // Gate 3: forbidden_while_audio_playing
  if (state.isAudioPlaying) {
    return {
      valid: false,
      result: { success: false, reason: 'forbidden_while_audio_playing', actions: [] },
    };
  }

  // Gate 4: wolfrobot_hunter_status_not_viewed
  // If current step is wolfRobotLearn and learned hunter but not viewed, reject advance
  if (
    state.currentStepId === 'wolfRobotLearn' &&
    state.wolfRobotReveal?.learnedRoleId === 'hunter' &&
    state.wolfRobotHunterStatusViewed === false
  ) {
    return {
      valid: false,
      result: { success: false, reason: 'wolfrobot_hunter_status_not_viewed', actions: [] },
    };
  }

  return { valid: true, state };
}

/**
 * 验证 SET_AUDIO_PLAYING 前置条件
 *
 * Gate 顺序：
 * 1. no_state
 * 2. invalid_status (must be ongoing or ended)
 *
 * 注：不检查 isAudioPlaying，因为这个 handler 就是用来设置它的
 */
export function validateSetAudioPlayingPreconditions(
  context: HandlerContext,
): { valid: false; result: HandlerResult } | { valid: true; state: NonNullState } {
  const { state } = context;

  // Gate 1: no_state
  if (!state) {
    return {
      valid: false,
      result: { success: false, reason: 'no_state', actions: [] },
    };
  }

  // Gate 2: invalid_status (must be ongoing or ended)
  // 允许 ended 状态是因为天亮音频在 endNight 之后播放
  if (state.status !== GameStatus.Ongoing && state.status !== GameStatus.Ended) {
    return {
      valid: false,
      result: { success: false, reason: 'invalid_status', actions: [] },
    };
  }

  return { valid: true, state };
}
