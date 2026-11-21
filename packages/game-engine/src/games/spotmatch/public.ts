/** Public pure Spotmatch API for transport, persistence and the client game module. */

export { getBotSeats, isBotOccupant, isBotSeat } from '../../platform/room/seating';
export type {
  SpotmatchCommand,
  SpotmatchInternalCommand,
  SpotmatchPublicCommand,
} from './commands/types';
export { SPOTMATCH_CARD_TYPES, type SpotmatchCard } from './domain/cards';
export {
  SPOTMATCH_REASONS,
  type SpotmatchDecision,
  type SpotmatchEffect,
  type SpotmatchEvent,
} from './domain/decision';
export {
  getSpotmatchViewModel,
  projectSpotmatchStateForUser,
  type SpotmatchSeatView,
  type SpotmatchViewModel,
} from './domain/visibility';
export {
  decideSpotmatchCommand,
  endSpotmatchGame,
  getSpotmatchLifecycle,
  spotmatchEngine,
} from './engine';
export {
  parseSpotmatchPublicStats,
  type SpotmatchCompletionPayload,
  spotmatchCompletionPayloadSchema,
  type SpotmatchPublicStats,
} from './publicStats';
export { SPOTMATCH_STATE_CODEC } from './state/codec';
export { parseSpotmatchConfig, parseSpotmatchState } from './state/parseState';
export {
  DEFAULT_SPOTMATCH_CONFIG,
  getSpotmatchOccupiedSeatCount,
  getSpotmatchUserSeat,
  isSpotmatchOccupiedSeat,
  isValidSpotmatchConfig,
  SPOTMATCH_CONFIG_SCHEMA,
  SPOTMATCH_DEFAULT_PLAYERS,
  SPOTMATCH_GAME_TYPE,
  SPOTMATCH_MAX_PLAYERS,
  SPOTMATCH_MIN_PLAYERS,
  SPOTMATCH_PHASES,
  SPOTMATCH_SUCCESS_PAUSE_MS,
  SPOTMATCH_WRONG_LOCK_MS,
  type SpotmatchConfig,
  type SpotmatchHumanSeat,
  type SpotmatchPhase,
  type SpotmatchPhaseKind,
  type SpotmatchState,
} from './state/types';
