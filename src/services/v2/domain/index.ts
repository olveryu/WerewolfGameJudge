/**
 * Domain Layer - Business Logic Engines
 *
 * Phase 3: Domain engines
 * - SeatEngine: Seat management (pure validation + state updates)
 *
 * Remaining (Phase 3):
 * - HostEngine
 * - PlayerEngine
 * - NightEngine
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

// Placeholder exports for Phase 3
// export { HostEngine } from './HostEngine';
// export { PlayerEngine } from './PlayerEngine';
// export { NightEngine } from './NightEngine';
