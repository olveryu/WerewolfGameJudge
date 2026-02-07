/**
 * Night Flow Handler - 夜晚流程处理器（re-export 入口）
 *
 * 职责：作为向后兼容的统一入口，re-export 拆分后的子模块
 *
 * ✅ 允许：re-export stepTransitionHandler + progressionEvaluator
 * ❌ 禁止：在此文件中新增业务逻辑（应写在对应子模块中）
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
