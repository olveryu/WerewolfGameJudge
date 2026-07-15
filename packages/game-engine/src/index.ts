/** Pure platform and product API shared by every game runtime. */

export { GAME_ENGINE_CATALOG, type GameEngineCatalog } from './games/catalog';
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
export { newRequestId, randomHex } from './platform/identifiers';
export type { ActionResult } from './platform/protocol/actionResult';
export {
  createRoomCommandResult,
  parseRoomCommandResult,
  RoomCommandProtocolError,
  type RoomCommandResult,
} from './platform/protocol/commandResult';
export type { RoomProfileUpdateCommand, RoomSeatCommand } from './platform/protocol/commands';
export type { FibKingGameType, GameType, WerewolfGameType } from './platform/protocol/gameTypes';
export {
  FIBKING_GAME_TYPE,
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
export {
  createUserEventAckMessage,
  parseUserEventAckMessage,
  type UserEventAckMessage,
} from './platform/protocol/userEvents';
export {
  createSeededRng,
  randomBool,
  randomIntInclusive,
  randomPick,
  type Rng,
  secureRng,
  shuffleArray,
} from './platform/random';
export { formatSeat } from './platform/room/formatSeat';
export type { RoomProfileUpdate, RoomSeatProfile, RosterEntry } from './platform/room/roster';
export {
  decideClearSeats,
  decideKickSeat,
  decideLeaveSeat,
  decideTakeSeat,
  findSeatByUserId,
  SEAT_OPERATION_REASONS,
  type SeatChange,
  type SeatMap,
  type SeatOccupant,
  type SeatOperationReason,
  type SeatOperationResult,
} from './platform/room/seating';
export {
  getLevel,
  getLevelProgress,
  LEVEL_THRESHOLDS,
  rollXp,
  XP_BASE,
  XP_RANDOM_BASE,
} from './product/growth';
export type { ResolvedRoleRevealAnimation, RoleRevealAnimation } from './product/rewards';
export {
  AVATAR_IDS,
  type DrawType,
  FRAME_IDS,
  FREE_AVATAR_IDS,
  FREE_FRAME_IDS,
  FREE_NAME_STYLE_IDS,
  getItemRarity,
  getUnlockedAvatars,
  getUnlockedFrames,
  getUnlockedNameStyles,
  GOLDEN_RATES,
  isFrameUnlocked,
  isNameStyleUnlocked,
  LEGENDARY_FRAME_IDS,
  NAME_STYLE_IDS,
  type NameStyleId,
  NORMAL_RATES,
  PITY_THRESHOLD,
  type Rarity,
  REWARD_POOL,
  type RewardItem,
  type RewardType,
  rollRarity,
  selectReward,
  TOTAL_UNLOCKABLE_COUNT,
} from './product/rewards';
