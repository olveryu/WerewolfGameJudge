/** 聚会工具对 Worker 与客户端开放的纯 API。 */

export type { ToolboxCommand, ToolboxPublicCommand } from './commands/types';
export {
  findToolboxIdentityConfigIssue,
  hasEnoughToolboxCards,
  isStorableToolboxIdentityConfig,
  isUsableToolboxIdentityConfig,
  type ToolboxIdentityConfigIssue,
} from './domain/config';
export {
  TOOLBOX_REASONS,
  type ToolboxDecision,
  type ToolboxEffect,
  type ToolboxEvent,
  type ToolboxReason,
} from './domain/decision';
export { projectToolboxStateForUser } from './domain/visibility';
export { decideToolboxCommand, getToolboxLifecycle, toolboxEngine } from './engine';
export { TOOLBOX_STATE_CODEC, TOOLBOX_VIEW_CODEC } from './state/codec';
export { parseToolboxIdentityConfig, parseToolboxState } from './state/parseState';
export {
  countToolboxIdentityCards,
  DEFAULT_TOOLBOX_CONFIG,
  DEFAULT_TOOLBOX_IDENTITY_CONFIG,
  normalizeToolboxName,
  TOOLBOX_DICE_DEFAULT_COUNT,
  TOOLBOX_DICE_FACES,
  TOOLBOX_DICE_MAX_COUNT,
  TOOLBOX_DICE_MIN_COUNT,
  TOOLBOX_GAME_TYPE,
  TOOLBOX_IDENTITY_LIMITS,
  TOOLBOX_TOOLS,
  type ToolboxConfig,
  type ToolboxDiceCup,
  type ToolboxDiceCupStage,
  type ToolboxDie,
  type ToolboxIdentityConfig,
  type ToolboxIdentityDefinition,
  type ToolboxState,
  type ToolboxTool,
} from './state/types';
export {
  parseToolboxView,
  type ToolboxIdentityRoundView,
  type ToolboxParticipationView,
  type ToolboxPhaseView,
  type ToolboxView,
} from './state/view';
