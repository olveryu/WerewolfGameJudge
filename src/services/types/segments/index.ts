/**
 * Facade segment interfaces barrel export
 *
 * Re-exports all 5 segment interfaces for convenient single-import.
 * The union `ILifecycleFacade & ISeatFacade & IGameControlFacade &
 * INightActionFacade & ISyncFacade` is structurally equivalent to
 * `IGameFacade` (verified by type assertion in IGameFacade.ts).
 */

export type { IGameControlFacade } from './IGameControlFacade';
export type { ILifecycleFacade } from './ILifecycleFacade';
export type { INightActionFacade } from './INightActionFacade';
export type { ISeatFacade } from './ISeatFacade';
export type { ISyncFacade } from './ISyncFacade';
