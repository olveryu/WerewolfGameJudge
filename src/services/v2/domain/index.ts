/**
 * Domain Layer - Business Logic Engines
 *
 * Phase 6: Domain layer complete with engines, resolvers, and DeathCalculator
 * - SeatEngine: Seat management (pure validation + state updates)
 * - NightEngine: Night flow state machine
 * - PlayerEngine: Player-side game logic
 * - HostEngine: Host-side game orchestration
 * - DeathCalculator: Pure function for calculating night deaths
 * - resolvers/: Role-specific action resolvers
 */

// SeatEngine - Seat management
export { SeatEngine } from './SeatEngine';
export type { SeatOperationResult, SeatFailReason, SitInput, StandupInput } from './SeatEngine';

// NightEngine - Night flow control
export { NightEngine, NightPhase, NightEvent } from './NightEngine';
export type { NightFlowState, NightPlanStep, NightStepInfo } from './NightEngine';

// PlayerEngine - Player-side game logic
export { PlayerEngine } from './PlayerEngine';
export type { PlayerEngineConfig, PlayerEventCallbacks } from './PlayerEngine';

// HostEngine - Host-side game orchestration
export { HostEngine } from './HostEngine';
export type { HostEngineConfig, HostEventCallbacks } from './HostEngine';

// DeathCalculator - Pure function for calculating night deaths
export { calculateDeaths } from './DeathCalculator';
export type { NightActions, RoleSeatMap } from './DeathCalculator';

// Resolvers - Role-specific action resolvers
export * from './resolvers';
