/**
 * Domain Layer - Business Logic Engines
 *
 * Phase 3: Domain engines
 * - SeatEngine: Seat management (pure validation + state updates)
 * - NightEngine: Night flow state machine
 *
 * Remaining (Phase 3):
 * - HostEngine
 * - PlayerEngine
 * - DeathCalculator
 * - resolvers/
 */

// SeatEngine - Seat management
export { SeatEngine } from './SeatEngine';
export type {
  SeatOperationResult,
  SeatFailReason,
  SitInput,
  StandupInput,
} from './SeatEngine';

// NightEngine - Night flow control
export { NightEngine, NightPhase, NightEvent } from './NightEngine';
export type { NightFlowState, NightPlanStep, NightStepInfo } from './NightEngine';

// Placeholder exports for Phase 3
// export { HostEngine } from './HostEngine';
// export { PlayerEngine } from './PlayerEngine';
