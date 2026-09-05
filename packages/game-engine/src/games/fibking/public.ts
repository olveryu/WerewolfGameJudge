/** Public pure API for the FibKing game module. */

export type {
  FibCommand,
  FibCompleteRoundCommand,
  FibFailPreparationCommand,
  FibInternalCommand,
  FibPublicCommand,
  FibUpdatePreparationStageCommand,
} from './commands/types';
export {
  REASON_FIB_GAME_NOT_ENDED,
  REASON_FIB_OCCUPIED_SEAT_OUT_OF_RANGE,
  REASON_FIB_PLAYER_COUNT_INVALID,
  REASON_FIB_PREPARATION_STAGE_INVALID,
  REASON_FIB_ROUND_ALREADY_ONGOING,
  REASON_FIB_ROUND_MISMATCH,
  REASON_FIB_ROUND_NOT_FULL,
  REASON_FIB_ROUND_NOT_ONGOING,
  REASON_FIB_ROUND_NOT_PREPARING,
  REASON_FIB_WORD_INVALID,
  REASON_FIB_WORD_REUSED,
} from './domain/reasons';
export { assignFibRoles } from './domain/roles';
export {
  type FibEndedRoundView,
  type FibOngoingRoundView,
  type FibRoundView,
  getFibRoundView,
  getFibUserSeat,
} from './domain/visibility';
export type { FibEffect, FibRecordWordUsageEffect, FibSelectWordEffect } from './effects/types';
export { decideFibCommand, type FibEngine, fibEngine, getFibLifecycle } from './engine';
export { type FibPublicStats, parseFibPublicStats } from './publicStats';
export { FIB_STATE_CODEC } from './state/codec';
export { parseFibState } from './state/parseState';
export {
  FIB_DEFAULT_PLAYERS,
  FIB_DEFINITION_FIELD_MAX_LENGTH,
  FIB_DEFINITION_FIELD_MIN_LENGTH,
  FIB_MAX_PLAYERS,
  FIB_MIN_PLAYERS,
  FIB_PREPARATION_FAILURE_CODES,
  FIB_PREPARATION_STAGES,
  FIB_USED_WORD_LIMIT,
  FIB_WORD_MAX_LENGTH,
  FIB_WORD_MIN_LENGTH,
  FIB_WORD_SOURCES,
  type FibConfig,
  type FibEndedState,
  type FibHumanSeat,
  type FibLobbyState,
  type FibOngoingState,
  type FibPhase,
  type FibPreparationFailedState,
  type FibPreparationFailure,
  type FibPreparationFailureCode,
  type FibPreparationStage,
  type FibPreparingState,
  type FibProfileUpdate,
  type FibRole,
  type FibRoleAssignment,
  type FibRound,
  type FibSeatProfile,
  type FibState,
  type FibWordDefinition,
  type FibWordSource,
  getFibBotDisplayName,
  getFibBotUserId,
  getFibOccupiedSeatCount,
  getFibRole,
  isFibImplicitBotSeat,
  isFibPreparationFailureCode,
  isFibPreparationStage,
  isFibRoomFull,
  isFibWordSource,
  isValidFibDefinitionField,
  isValidFibPlayerCount,
  isValidFibWord,
  type PendingFibRound,
} from './state/types';
export { FIB_STATE_IDENTITY, FIB_STATE_VERSION } from './state/version';
