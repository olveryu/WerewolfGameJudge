/**
 * @werewolf/game-engine - 纯游戏逻辑共享包
 *
 * 包含模型定义、游戏引擎（handlers + reducer + store）、
 * resolver、协议类型等，可被客户端和服务端同时 import。
 *
 * ✅ 允许：纯逻辑、类型定义、声明式配置
 * ❌ 禁止：React Native / Expo UI 依赖
 */

// === Utils (platform-agnostic) ===
export { newRejectionId, newRequestId, randomHex } from './utils/id';
export { type EngineLogger, getEngineLogger, setEngineLogger } from './utils/logger';
export { type Rng, secureRng } from './utils/random';
export { shuffleArray } from './utils/shuffle';

// === Models ===
export * from './models/actions/RoleAction';
export * from './models/actions/WitchAction';
export * from './models/GameStatus';
export * from './models/roles';
export * from './models/Template';

// === Protocol ===
export * from './protocol/reasonCodes';
export * from './protocol/types';

// === Types ===
export * from './types/RoleRevealAnimation';

// === Resolvers ===
export * from './resolvers';
export * from './resolvers/types';

// === Engine ===
export { calculateDeaths } from './engine/DeathCalculator';
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
  handleStartNight,
  handleUpdateTemplate,
} from './engine/handlers/gameControlHandler';
export {
  decideWolfVoteTimerAction,
  isWolfVoteAllComplete,
  WOLF_VOTE_COUNTDOWN_MS,
} from './engine/handlers/progressionEvaluator';
export { handleJoinSeat, handleLeaveMySeat } from './engine/handlers/seatHandler';
export {
  handleAdvanceNight,
  handleEndNight,
  handleSetAudioPlaying,
} from './engine/handlers/stepTransitionHandler';
export * from './engine/handlers/types';
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
export * from './engine/store';
