/** Public pure DrawGuess API for transport, persistence and the client game module. */

export type {
  DrawGuessCommand,
  DrawGuessInternalCommand,
  DrawGuessPublicCommand,
} from './commands/types';
export { DRAWGUESS_REASONS, type DrawGuessEffect } from './domain/decision';
export { isValidGuessText } from './domain/rules';
export { type DrawGuessViewModel, getDrawGuessViewModel } from './domain/visibility';
export { decideDrawGuessCommand, drawGuessEngine, getDrawGuessLifecycle } from './engine';
export { DRAWGUESS_STATE_CODEC, parseDrawGuessConfig, parseDrawGuessState } from './state/codec';
export {
  DEFAULT_DRAWGUESS_CONFIG,
  DRAWGUESS_DRAWING_DURATION_SECONDS,
  DRAWGUESS_HINT_REVEAL_INTERVAL_SECONDS,
  DRAWGUESS_MAX_PLAYERS,
  DRAWGUESS_MIN_PLAYERS,
  DRAWGUESS_MIN_SEATS_TO_START,
  DRAWGUESS_ROUND_END_SECONDS,
  DRAWGUESS_ROUNDS_PER_DRAWER,
  DRAWGUESS_WORD_CATEGORIES,
  DRAWGUESS_WORD_CHOICE_COUNT,
  DRAWGUESS_WORD_SELECT_SECONDS,
  type DrawGuessConfig,
  type DrawGuessDrawingReservation,
  type DrawGuessPhase,
  type DrawGuessState,
  type DrawGuessStroke,
  type DrawGuessWordCategory,
  type DrawGuessWordChoice,
  getDrawGuessBotDisplayName,
  getDrawGuessOccupiedSeatCount,
  getDrawGuessRealHumanCount,
  isDrawGuessImplicitBotSeat,
} from './state/types';
