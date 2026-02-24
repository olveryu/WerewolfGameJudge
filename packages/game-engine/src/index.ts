/**
 * @werewolf/game-engine - 纯游戏逻辑共享包
 *
 * 包含模型定义、游戏引擎（handlers + reducer + store）、
 * resolver、协议类型等，可被客户端和服务端同时 import。
 * 导出纯逻辑、类型定义与声明式配置，不依赖 React Native / Expo UI。
 */

// === Utils (platform-agnostic) ===
export { resolveSeerAudioKey } from './utils/audioKeyOverride';
export { newRejectionId, newRequestId, randomHex } from './utils/id';
export {
  createSeededRng,
  randomBool,
  randomIntInclusive,
  randomPick,
  type Rng,
  secureRng,
} from './utils/random';
export { shuffleArray } from './utils/shuffle';

// === Models ===
export {
  makeActionMagicianSwap,
  makeActionTarget,
  makeActionWitch,
  type RoleAction,
} from './models/actions/RoleAction';
export {
  makeWitchNone,
  makeWitchPoison,
  makeWitchSave,
  type WitchAction,
} from './models/actions/WitchAction';
export { GameStatus } from './models/GameStatus';
export {
  type ActionSchema,
  buildNightPlan,
  canRoleSeeWolves,
  doesRoleParticipateInWolfVote,
  Faction,
  getAllRoleIds,
  getRoleDisplayAs,
  getRoleDisplayName,
  getRoleSpec,
  getSchema,
  getWolfKillImmuneRoleIds,
  isValidRoleId,
  isWolfRole,
  type NightPlan,
  type RevealKind,
  ROLE_SPECS,
  type RoleId,
  type SchemaId,
  SCHEMAS,
} from './models/roles';
export {
  createCustomTemplate,
  createTemplateFromRoles,
  findMatchingPresetName,
  type GameTemplate,
  PRESET_TEMPLATES,
  validateTemplateRoles,
} from './models/Template';

// === Protocol ===
export {
  type AudioEffect,
  type GameState,
  type Player,
  type PlayerMessage,
  type ProtocolAction,
} from './protocol/types';

// === Types ===
export type { ResolvedRoleRevealAnimation, RoleRevealAnimation } from './types/RoleRevealAnimation';

// === Resolvers ===
export { RESOLVERS } from './resolvers';
export {
  type ActionInput,
  type CurrentNightResults,
  type ResolverContext,
  resolveRoleForChecks,
} from './resolvers/types';

// === Engine ===
export {
  handleSubmitAction,
  handleSubmitWolfVote,
  handleViewedRole,
} from './engine/handlers/actionHandler';
export {
  handleAssignRoles,
  handleFillWithBots,
  handleMarkAllBotsViewed,
  handleRestartGame,
  handleSetRoleRevealAnimation,
  handleShareNightReview,
  handleStartNight,
  handleUpdateTemplate,
} from './engine/handlers/gameControlHandler';
export {
  decideWolfVoteTimerAction,
  isWolfVoteAllComplete,
} from './engine/handlers/progressionEvaluator';
export {
  handleClearAllSeats,
  handleJoinSeat,
  handleLeaveMySeat,
} from './engine/handlers/seatHandler';
export {
  handleAdvanceNight,
  handleEndNight,
  handleSetAudioPlaying,
} from './engine/handlers/stepTransitionHandler';
export { type HandlerContext, type HandlerResult, type SideEffect } from './engine/handlers/types';
export { handleSetWolfRobotHunterStatusViewed } from './engine/handlers/wolfRobotHunterGateHandler';
export { runInlineProgression } from './engine/inlineProgression';
export type {
  EndNightIntent,
  JoinSeatIntent,
  LeaveMySeatIntent,
  SetAudioPlayingIntent,
  SubmitActionIntent,
  SubmitWolfVoteIntent,
} from './engine/intents/types';
export { gameReducer } from './engine/reducer';
export type { StateAction } from './engine/reducer/types';
export { resolveWolfVotes } from './engine/resolveWolfVotes';
export { buildInitialGameState } from './engine/state/buildInitialState';
export { normalizeState } from './engine/state/normalize';
export { GameStore } from './engine/store';
