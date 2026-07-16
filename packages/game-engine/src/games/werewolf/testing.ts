/** Test harness API for exercising Werewolf domain transitions outside this package. */

export type { DeathReason, DeathsDetailed } from './domain/DeathCalculator';
export { handleSubmitAction } from './domain/handlers/actionHandler';
export { handleAdvanceNight, handleEndNight } from './domain/handlers/stepTransitionHandler';
export {
  type HandlerContext,
  type HandlerExecutionContext,
  type HandlerResult,
  handlerSuccess,
} from './domain/handlers/types';
export { handleSetWolfRobotHunterStatusViewed } from './domain/handlers/wolfRobotHunterGateHandler';
export type { SubmitActionIntent } from './domain/intents/types';
export { gameReducer } from './domain/reducer';
export type { StateAction } from './domain/reducer/types';
export type { ActionInput } from './domain/resolvers/types';
export { buildInitialGameState } from './domain/state/buildInitialState';
export { normalizeState } from './domain/state/normalize';
