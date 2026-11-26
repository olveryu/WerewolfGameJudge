/** Public pure Decrypto API for transport, persistence and the client game module. */

export { getBotSeats, isBotOccupant, isBotSeat } from '../../platform/room/seating';
export type {
  DecryptoCommand,
  DecryptoInternalCommand,
  DecryptoPublicCommand,
} from './commands/types';
export {
  DECRYPTO_REASONS,
  type DecryptoDecision,
  type DecryptoEffect,
  type DecryptoEvent,
} from './domain/decision';
export {
  type DecryptoSeatView,
  type DecryptoViewModel,
  getDecryptoViewModel,
  isDecryptoResultRevealed,
  projectDecryptoStateForUser,
} from './domain/visibility';
export { decideDecryptoCommand, decryptoEngine, getDecryptoLifecycle } from './engine';
export {
  type DecryptoCompletionPayload,
  decryptoCompletionPayloadSchema,
  type DecryptoPublicStats,
  parseDecryptoPublicStats,
} from './publicStats';
export { DECRYPTO_STATE_CODEC } from './state/codec';
export { parseDecryptoConfig, parseDecryptoState } from './state/parseState';
export {
  DECRYPTO_CODES,
  DECRYPTO_CONFIG_SCHEMA,
  DECRYPTO_DEFAULT_PLAYERS,
  DECRYPTO_GAME_TYPE,
  DECRYPTO_MAX_PLAYERS,
  DECRYPTO_MAX_ROUNDS,
  DECRYPTO_MIN_PLAYERS,
  DECRYPTO_PHASES,
  DECRYPTO_REVEAL_INTERVAL_MS,
  DECRYPTO_TEAMS,
  type DecryptoAssignments,
  type DecryptoClueTriple,
  type DecryptoCode,
  type DecryptoConfig,
  type DecryptoEncryptors,
  type DecryptoGame,
  type DecryptoHistoryEntry,
  type DecryptoHumanSeat,
  type DecryptoKeywords,
  type DecryptoKeywordSets,
  type DecryptoOutcome,
  type DecryptoPhase,
  type DecryptoPhaseKind,
  type DecryptoState,
  type DecryptoTeam,
  DEFAULT_DECRYPTO_CONFIG,
  getDecryptoOccupiedSeatCount,
  getDecryptoUserSeat,
  isDecryptoOccupiedSeat,
  isValidDecryptoConfig,
} from './state/types';
export {
  DECRYPTO_WORD_CATEGORIES,
  DECRYPTO_WORD_CATEGORY_NAMES,
  type DecryptoWordCategory,
} from './wordCategories';
