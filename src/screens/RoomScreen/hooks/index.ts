/**
 * RoomScreen hooks barrel file
 */
export { useActionerState } from './useActionerState';
export type { UseActionerStateParams } from './useActionerState';

export { useRoomInit } from './useRoomInit';
export type { UseRoomInitParams, UseRoomInitResult } from './useRoomInit';

export { useRoomActions } from './useRoomActions';
export type {
  ActionIntent,
  ActionIntentType,
  ActionDeps,
  GameContext,
  UseRoomActionsResult,
} from './useRoomActions';

export { useActionOrchestrator } from './useActionOrchestrator';
export type {
  UseActionOrchestratorParams,
  UseActionOrchestratorResult,
} from './useActionOrchestrator';

export { useInteractionDispatcher } from './useInteractionDispatcher';
export type {
  UseInteractionDispatcherParams,
  UseInteractionDispatcherResult,
} from './useInteractionDispatcher';
