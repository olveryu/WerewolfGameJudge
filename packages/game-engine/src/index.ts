/**
 * @werewolf/game-engine - 纯游戏逻辑共享包
 *
 * 包含模型定义、游戏引擎（handlers + reducer + store）、
 * resolver、协议类型等，可被客户端和服务端同时 import。
 * 导出纯逻辑、类型定义与声明式配置，不依赖 React Native / Expo UI。
 */

// === Utils (platform-agnostic) ===
export { resolveSeerAudioKey } from './utils/audioKeyOverride';
export { formatSeat } from './utils/formatSeat';
export { newRejectionId, newRequestId, randomHex } from './utils/id';
export { getBottomCardEffectiveRole } from './utils/playerHelpers';
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
  getRoleEmoji,
  getRoleSpec,
  getRoleStructuredDescription,
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
  BOTTOM_CARD_COUNT,
  createCustomTemplate,
  createTemplateFromRoles,
  findMatchingPresetName,
  type GameTemplate,
  getPlayerCount,
  PRESET_TEMPLATES,
  type PresetTemplate,
  TEMPLATE_CATEGORY_LABELS,
  TemplateCategory,
  validateTemplateRoles,
} from './models/Template';

// === Protocol ===
export {
  type AudioEffect,
  type BoardNomination,
  type ConfirmStatus,
  type FactionConfirmStatus,
  type GameState,
  type Player,
  type PlayerMessage,
  type ProtocolAction,
  type RosterEntry,
  type ShootConfirmStatus,
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
export type { DeathReason, DeathsDetailed } from './engine/DeathCalculator';
export { handleSubmitAction, handleViewedRole } from './engine/handlers/actionHandler';
export {
  handleAssignRoles,
  handleBoardNominate,
  handleBoardUpvote,
  handleBoardWithdraw,
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
  WOLF_VOTE_COUNTDOWN_MS,
} from './engine/handlers/progressionEvaluator';
export {
  handleClearAllSeats,
  handleJoinSeat,
  handleKickPlayer,
  handleLeaveMySeat,
  handleUpdatePlayerProfile,
} from './engine/handlers/seatHandler';
export {
  handleAdvanceNight,
  handleEndNight,
  handleSetAudioPlaying,
} from './engine/handlers/stepTransitionHandler';
export { type HandlerContext, type HandlerResult, type SideEffect } from './engine/handlers/types';
export { handleSetWolfRobotHunterStatusViewed } from './engine/handlers/wolfRobotHunterGateHandler';
export {
  AUTO_SKIP_DELAY_MAX_MS,
  AUTO_SKIP_DELAY_MIN_MS,
  runInlineProgression,
} from './engine/inlineProgression';
export type {
  BoardNominateIntent,
  BoardUpvoteIntent,
  BoardWithdrawIntent,
  EndNightIntent,
  JoinSeatIntent,
  LeaveMySeatIntent,
  SetAudioPlayingIntent,
  SubmitActionIntent,
  UpdatePlayerProfileIntent,
} from './engine/intents/types';
export { gameReducer } from './engine/reducer';
export type { StateAction } from './engine/reducer/types';
export { resolveWolfVotes } from './engine/resolveWolfVotes';
export { buildInitialGameState } from './engine/state/buildInitialState';
export { normalizeState } from './engine/state/normalize';
export { GameStore } from './engine/store';

// === Growth ===
export {
  AVATAR_IDS,
  type DrawType,
  FRAME_IDS,
  FREE_AVATAR_IDS,
  FREE_FRAME_IDS,
  FREE_NAME_STYLE_IDS,
  getItemRarity,
  getLevel,
  getLevelProgress,
  getUnlockedAvatars,
  getUnlockedFrames,
  getUnlockedNameStyles,
  GOLDEN_RATES,
  isFrameUnlocked,
  isNameStyleUnlocked,
  LEGENDARY_FRAME_IDS,
  LEVEL_THRESHOLDS,
  NAME_STYLE_IDS,
  type NameStyleId,
  NORMAL_RATES,
  pickRandomReward,
  PITY_THRESHOLD,
  type Rarity,
  REWARD_POOL,
  type RewardItem,
  type RewardType,
  rollRarity,
  rollXp,
  selectReward,
  TOTAL_UNLOCKABLE_COUNT,
  XP_BASE,
  XP_RANDOM_MAX,
} from './growth';
