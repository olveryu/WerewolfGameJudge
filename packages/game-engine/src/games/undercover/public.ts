/** Public Undercover module contract; domain implementation remains package-private. */

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
} from './domain/rules';
export { getUndercoverWordCard, type UndercoverWordCard } from './domain/visibility';
export { type UndercoverEngine, undercoverEngine } from './engine';
export { migratePersistedUndercoverState, UNDERCOVER_STATE_CODEC } from './state/codec';
export { isValidUndercoverConfig, isValidUndercoverWordPair } from './state/normalize';
export {
  getUndercoverOccupiedSeatCount,
  isUndercoverSeat,
  UNDERCOVER_CATEGORIES,
  UNDERCOVER_STATE_VERSION,
  type UndercoverCategory,
  type UndercoverConfig,
  type UndercoverHumanSeat,
  type UndercoverPreparationFailure,
  type UndercoverRound,
  type UndercoverState,
  type UndercoverWordPair,
} from './state/types';
