/** Public pure Demo API for transport, persistence and the client game module. */

export { getBotSeats, isBotOccupant, isBotSeat } from '../../platform/room/seating';
export type { DemoCommand, DemoInternalCommand, DemoPublicCommand } from './commands/types';
export {
  DEMO_REASONS,
  type DemoDecision,
  type DemoEffect,
  type DemoEvent,
} from './domain/decision';
export { DEMO_STAGE_DURATION_MS } from './domain/rules';
export { type DemoSeatView, type DemoViewModel, getDemoViewModel } from './domain/visibility';
export { decideDemoCommand, demoEngine, endDemoGame, getDemoLifecycle } from './engine';
export { DEMO_STATE_CODEC } from './state/codec';
export { migratePersistedDemoState, parseDemoConfig, parseDemoState } from './state/parseState';
export {
  DEFAULT_DEMO_CONFIG,
  DEMO_DEFAULT_PLAYERS,
  DEMO_GAME_TYPE,
  DEMO_MAX_PLAYERS,
  DEMO_MIN_PLAYERS,
  DEMO_PHASES,
  DEMO_TODO_IDENTITY,
  type DemoConfig,
  type DemoHumanSeat,
  type DemoPhase,
  type DemoPhaseKind,
  type DemoState,
  getDemoOccupiedSeatCount,
  getDemoUserSeat,
  getDemoViewingParticipants,
  isDemoOccupiedSeat,
  isValidDemoConfig,
} from './state/types';
export { DEMO_STATE_IDENTITY, DEMO_STATE_VERSION } from './state/version';
