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
export {
  describeSecrethitlerStepConfirmation,
  hasViewedSecrethitlerNightStep,
  SECRETHITLER_NIGHT_VIEW_ACTION_KEY,
} from './domain/nightSteps';
export {
  getSecrethitlerNightParticipants,
  getSecrethitlerPolicyPower,
  getSecrethitlerRoleCounts,
} from './domain/rules';
export {
  getSecrethitlerViewModel,
  type SecrethitlerGovernmentView,
  type SecrethitlerHistoryView,
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
export { parseSecrethitlerConfig, parseSecrethitlerState } from './state/parseState';
export {
  DEFAULT_SECRETHITLER_CONFIG,
  getSecrethitlerOccupiedSeatCount,
  getSecrethitlerUserSeat,
  getSecrethitlerViewingParticipants,
  isSecrethitlerOccupiedSeat,
  isValidSecrethitlerConfig,
  SECRETHITLER_CONFIG_SCHEMA,
  SECRETHITLER_DEFAULT_PLAYERS,
  SECRETHITLER_DEFAULT_VOTE_MODE,
  SECRETHITLER_GAME_TYPE,
  SECRETHITLER_MAX_PLAYERS,
  SECRETHITLER_MIN_PLAYERS,
  SECRETHITLER_NIGHT_STEP_IDS,
  SECRETHITLER_PHASES,
  SECRETHITLER_VOTE_MODES,
  type SecrethitlerConfig,
  type SecrethitlerEndReason,
  type SecrethitlerFaction,
  type SecrethitlerHumanSeat,
  type SecrethitlerNightStep,
  type SecrethitlerPhase,
  type SecrethitlerPhaseKind,
  type SecrethitlerPolicy,
  type SecrethitlerRole,
  type SecrethitlerState,
  type SecrethitlerVote,
  type SecrethitlerVoteMode,
  type SecrethitlerWinner,
} from './state/types';
