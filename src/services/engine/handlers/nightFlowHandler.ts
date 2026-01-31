/**
 * Night Flow Handler - 夜晚流程处理器
 *
 * 此文件现在作为 re-export 入口，保持向后兼容。
 *
 * 实际实现已拆分为：
 * - stepTransitionHandler.ts: 步骤切换逻辑（handleAdvanceNight, handleEndNight, handleSetAudioPlaying）
 * - progressionEvaluator.ts: 幂等推进决策（evaluateNightProgression, handleNightProgression）
 */

// =============================================================================
// Re-exports from stepTransitionHandler.ts
// =============================================================================

export {
  handleAdvanceNight,
  handleEndNight,
  handleSetAudioPlaying,
  validateNightFlowPreconditions,
} from './stepTransitionHandler';

// =============================================================================
// Re-exports from progressionEvaluator.ts
// =============================================================================

export {
  // Types
  type NightProgressionDecision,
  type ProgressionTracker,
  type NightProgressionCallbacks,
  type NightProgressionResult,
  // Functions
  createProgressionTracker,
  buildProgressionKey,
  evaluateNightProgression,
  resetProgressionTracker,
  handleNightProgression,
} from './progressionEvaluator';
