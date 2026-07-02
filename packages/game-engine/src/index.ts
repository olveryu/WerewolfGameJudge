/**
 * @werewolf/game-engine - Pure shared game logic package
 *
 * Contains model definitions, game engine (handlers + reducer + store),
 * resolvers, protocol types, etc. Importable by both client and server.
 * Exports pure logic, type definitions, and declarative config. No dependency on React Native / Expo UI.
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
} from './werewolf/models/actions/RoleAction';
export {
  makeWitchNone,
  makeWitchPoison,
  makeWitchSave,
  type WitchAction,
} from './werewolf/models/actions/WitchAction';
export { GameStatus } from './werewolf/models/GameStatus';
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
} from './werewolf/models/roles';
export {
  BOTTOM_CARD_COUNT,
  createCustomTemplate,
  createTemplateFromRoles,
  findClosestPresetName,
  findMatchingPresetName,
  type GameTemplate,
  getPlayerCount,
  PRESET_TEMPLATES,
  type PresetTemplate,
  TEMPLATE_CATEGORY_LABELS,
  TemplateCategory,
  validateTemplateRoles,
} from './werewolf/models/Template';

// === Protocol ===
export {
  FIB_GAME_TYPE,
  GAME_TYPES,
  type GameType,
  isGameType,
  WEREWOLF_GAME_TYPE,
} from './protocol/gameTypes';
export {
  type AudioEffect,
  type BoardNomination,
  type ConfirmStatus,
  type FactionConfirmStatus,
  type Player,
  type PlayerMessage,
  type ProtocolAction,
  type RosterEntry,
  type ShootConfirmStatus,
  type WerewolfState,
} from './werewolf/protocol/types';

// === Cosmetics ===
export {
  FREE_ROLE_REVEAL_EFFECT_IDS,
  RANDOMIZABLE_ANIMATIONS,
  type ResolvedRoleRevealAnimation,
  resolveRandomAnimation,
  ROLE_REVEAL_EFFECT_IDS,
  type RoleRevealAnimation,
  type RoleRevealEffectId,
} from './cosmetics/roleRevealEffects';

// === Resolvers ===
export { RESOLVERS } from './werewolf/resolvers';
export {
  type ActionInput,
  type CurrentNightResults,
  type ResolverContext,
  resolveRoleForChecks,
} from './werewolf/resolvers/types';

// === Engine ===
export type { DeathReason, DeathsDetailed } from './werewolf/DeathCalculator';
export { handleSubmitAction, handleViewedRole } from './werewolf/handlers/actionHandler';
export {
  handleAssignRoles,
  handleBoardNominate,
  handleBoardUpvote,
  handleBoardWithdraw,
  handleFillWithBots,
  handleMarkAllBotsViewed,
  handleRestartGame,
  handleShareNightReview,
  handleStartNight,
  handleUpdateTemplate,
} from './werewolf/handlers/gameControlHandler';
export {
  decideWolfVoteTimerAction,
  isWolfVoteAllComplete,
  WOLF_VOTE_COUNTDOWN_MS,
} from './werewolf/handlers/progressionEvaluator';
export {
  handleClearAllSeats,
  handleJoinSeat,
  handleKickPlayer,
  handleLeaveMySeat,
  handleUpdatePlayerProfile,
} from './werewolf/handlers/seatHandler';
export {
  handleAdvanceNight,
  handleEndNight,
  handleSetAudioPlaying,
} from './werewolf/handlers/stepTransitionHandler';
export {
  type HandlerContext,
  type HandlerResult,
  type SideEffect,
} from './werewolf/handlers/types';
export { handleSetWolfRobotHunterStatusViewed } from './werewolf/handlers/wolfRobotHunterGateHandler';
export {
  AUTO_SKIP_DELAY_MAX_MS,
  AUTO_SKIP_DELAY_MIN_MS,
  runInlineProgression,
} from './werewolf/inlineProgression';
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
} from './werewolf/intents/types';
export { werewolfReducer } from './werewolf/reducer';
export type { StateAction } from './werewolf/reducer/types';
export { resolveWolfVotes } from './werewolf/resolveWolfVotes';
export { buildInitialWerewolfStateFromTemplate } from './werewolf/state/buildInitialWerewolfState';
export { normalizeWerewolfState } from './werewolf/state/normalizeWerewolfState';
export { WerewolfStore } from './werewolf/store';

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
  XP_RANDOM_BASE,
} from './growth';
