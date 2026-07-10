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

// === Platform ===
export type {
  WerewolfActionInput,
  WerewolfCommand,
  WerewolfInternalCommand,
  WerewolfProfileUpdate,
  WerewolfPublicCommand,
  WerewolfSeatProfile,
} from './games/werewolf/commands/types';
export {
  type CommandActor,
  type CommandContext,
  type CommandExecutionContext,
  type CommandOf,
  commit,
  commitDomainRejection,
  type CommittedCommandOutcome,
  type CommonGameLifecycle,
  type ConfigOf,
  type CreateGameContext,
  type Decision,
  defineGameEngineCatalog,
  type EffectOf,
  type EventOf,
  type GameCommand,
  type GameEffect,
  type GameEngineDefinition,
  type GameEvent,
  reject,
  type StateOf,
} from './platform/engine';
export {
  createRoomCommandResult,
  parseRoomCommandResult,
  RoomCommandProtocolError,
  type RoomCommandResult,
} from './platform/protocol/commandResult';
export type { RoomProfileUpdateCommand, RoomSeatCommand } from './platform/protocol/commands';
export {
  decideClearSeats,
  decideKickSeat,
  decideLeaveSeat,
  decideTakeSeat,
  SEAT_OPERATION_REASONS,
  type SeatChange,
  type SeatMap,
  type SeatOccupant,
  type SeatOperationReason,
  type SeatOperationResult,
} from './platform/room/seating';

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
  findClosestPresetName,
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
export { WEREWOLF_STATE_CODEC } from './games/werewolf/state/codec';
export { parseWerewolfState } from './games/werewolf/state/parseState';
export { WEREWOLF_STATE_IDENTITY, WEREWOLF_STATE_VERSION } from './games/werewolf/state/version';
export type { GameType, WerewolfGameType } from './platform/protocol/gameTypes';
export {
  GAME_TYPES,
  isGameType,
  parseGameType,
  WEREWOLF_GAME_TYPE,
} from './platform/protocol/gameTypes';
export type {
  BaseGameState,
  GameStateCodec,
  GameStateIdentity,
  RoomSnapshot,
  StateUpdateMessage,
} from './platform/protocol/roomSnapshot';
export {
  assertRoomSnapshotIdentity,
  createRoomSnapshot,
  createStateUpdateMessage,
  parseRoomSnapshot,
  parseStateUpdateMessage,
} from './platform/protocol/roomSnapshot';

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
