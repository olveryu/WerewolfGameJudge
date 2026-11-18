/** Public pure Secrethitler API for transport, persistence and the client game module. */

export type { AudioEffect } from '../../platform/audio';
export { getBotSeats, isBotOccupant, isBotSeat } from '../../platform/room/seating';
export type {
  SecrethitlerCommand,
  SecrethitlerInternalCommand,
  SecrethitlerPublicCommand,
} from './commands/types';
export {
  SECRETHITLER_REASONS,
  type SecrethitlerDecision,
  type SecrethitlerEffect,
  type SecrethitlerEvent,
} from './domain/decision';
export { getSecrethitlerNightParticipants, getSecrethitlerRoleCounts } from './domain/rules';
export {
  getSecrethitlerViewModel,
  type SecrethitlerSeatView,
  type SecrethitlerViewModel,
} from './domain/visibility';
export { decideSecrethitlerCommand, getSecrethitlerLifecycle, secrethitlerEngine } from './engine';
export {
  parseSecrethitlerPublicStats,
  type SecrethitlerCompletionPayload,
  secrethitlerCompletionPayloadSchema,
  type SecrethitlerPublicStats,
} from './publicStats';
export { SECRETHITLER_STATE_CODEC } from './state/codec';
export {
  migratePersistedSecrethitlerState,
  parseSecrethitlerConfig,
  parseSecrethitlerState,
} from './state/parseState';
export {
  DEFAULT_SECRETHITLER_CONFIG,
  getSecrethitlerOccupiedSeatCount,
  getSecrethitlerUserSeat,
  getSecrethitlerViewingParticipants,
  isSecrethitlerOccupiedSeat,
  isValidSecrethitlerConfig,
  SECRETHITLER_CONFIG_SCHEMA,
  SECRETHITLER_DEFAULT_PLAYERS,
  SECRETHITLER_GAME_TYPE,
  SECRETHITLER_MAX_PLAYERS,
  SECRETHITLER_MIN_PLAYERS,
  SECRETHITLER_PHASES,
  type SecrethitlerConfig,
  type SecrethitlerEndReason,
  type SecrethitlerFaction,
  type SecrethitlerHumanSeat,
  type SecrethitlerPhase,
  type SecrethitlerPhaseKind,
  type SecrethitlerPolicy,
  type SecrethitlerRole,
  type SecrethitlerState,
  type SecrethitlerVote,
  type SecrethitlerWinner,
} from './state/types';
export { SECRETHITLER_STATE_IDENTITY, SECRETHITLER_STATE_VERSION } from './state/version';
