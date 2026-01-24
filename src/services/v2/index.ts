/**
 * V2 Services - 公共 API
 *
 * 重构后的服务层，采用 SRP 设计：
 * - GameStore: 状态持有与订阅
 * - Reducer: 纯函数状态转换
 * - Handlers: Intent → StateAction 转换
 * - Transport: 网络传输适配
 * - Factory: 服务组装
 */

// Store
export { GameStore } from './store';
export type { GameState, StateListener, IGameStore, IHostGameStore } from './store/types';

// Reducer
export { gameReducer } from './reducer';
export type { StateAction } from './reducer/types';

// Intents
export type { GameIntent } from './intents';

// Handlers
export {
  handleJoinSeat,
  handleLeaveMySeat,
  handleStartGame,
  handleRestartGame,
  handleSubmitAction,
  handleSubmitWolfVote,
  handleViewedRole,
} from './handlers';
export type { Handler, HandlerContext, HandlerResult } from './handlers/types';

// Transport
export { TransportAdapter } from '../transport';
export type { TransportListener } from '../transport';

// Factory
export { createGameServices, destroyGameServices } from './factory';
export type { GameServices, CreateServicesOptions } from './factory';
