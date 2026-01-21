/**
 * Domain Layer - Business Logic Engines
 *
 * Phase 3: Domain engines
 * - SeatEngine: Seat management (pure validation + state updates)
 * - NightEngine: Night flow state machine
 * - PlayerEngine: Player-side game logic
 * - HostEngine: Host-side game orchestration
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

// PlayerEngine - Player-side game logic
export { PlayerEngine } from './PlayerEngine';
export type { PlayerEngineConfig, PlayerEventCallbacks } from './PlayerEngine';

// HostEngine - Host-side game orchestration
export { HostEngine } from './HostEngine';
export type { HostEngineConfig, HostEventCallbacks } from './HostEngine';
