/** Public Undercover module contract; domain implementation remains package-private. */

export { buildPreparationFailureCommand } from '../../platform/room/preparation';
export { isBotOccupant } from '../../platform/room/seating';
export type {
  UndercoverCommand,
  UndercoverInternalCommand,
  UndercoverPublicCommand,
} from './commands/types';
export { UNDERCOVER_REASONS } from './domain/decision';
export type { UndercoverEffect, UndercoverEvent } from './domain/events';
export {
  getUndercoverRoleCounts,
  getUndercoverWinner,
  UNDERCOVER_BLANK_MIN_PLAYERS,
  UNDERCOVER_DEFAULT_PLAYERS,
  UNDERCOVER_MAX_PLAYERS,
  UNDERCOVER_MIN_PLAYERS,
  type UndercoverRole,
  type UndercoverRoleCounts,
} from './domain/rules';
export { getUndercoverWordCard, type UndercoverWordCard } from './domain/visibility';
export { type UndercoverEngine, undercoverEngine } from './engine';
export { UNDERCOVER_STATE_CODEC } from './state/codec';
export { isValidUndercoverConfig, isValidUndercoverWordPair } from './state/normalize';
export { migratePersistedUndercoverState } from './state/parseState';
export {
  getUndercoverBotSeats,
  getUndercoverOccupiedSeatCount,
  getUndercoverUserSeat,
  isUndercoverBotSeat,
  isUndercoverSeat,
  UNDERCOVER_CATEGORIES,
  type UndercoverCategory,
  type UndercoverConfig,
  type UndercoverHumanSeat,
  type UndercoverPreparationFailure,
  type UndercoverRound,
  type UndercoverState,
  type UndercoverWordPair,
} from './state/types';
export { UNDERCOVER_STATE_IDENTITY, UNDERCOVER_STATE_VERSION } from './state/version';
