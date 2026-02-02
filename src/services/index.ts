/**
 * Services Public API
 *
 * 统一导出入口。新结构如下：
 * - infra/: 基础设施服务 (Audio/Auth/Avatar/Room)
 * - transport/: 网络传输 (BroadcastService + TransportAdapter)
 * - engine/: 纯游戏逻辑 (handlers/reducer/store/intents)
 * - facade/: 高层 API (GameFacade)
 * - protocol/: 协议类型定义
 * - types/: 共享类型
 */

// =============================================================================
// Infra: 基础设施服务
// =============================================================================
export { default as AudioService } from './infra/AudioService';
export { AuthService } from './infra/AuthService';
export { AvatarUploadService } from './infra/AvatarUploadService';
export { SimplifiedRoomService, type RoomRecord } from './infra/RoomService';
export {
  default as SettingsService,
  type UserSettings,
  type ThemeKey,
} from './infra/SettingsService';

// =============================================================================
// Transport: 网络传输
// =============================================================================
export {
  BroadcastService,
  type HostBroadcast,
  type PlayerMessage,
  type BroadcastGameState,
  type BroadcastPlayer,
} from './transport/BroadcastService';
export { TransportAdapter, type TransportListener } from './transport';

// =============================================================================
// Engine: 纯游戏逻辑（Host-only）
// =============================================================================
export {
  // Store
  GameStore,
  type GameState,
  type StateListener,
  type IGameStore,
  type IHostGameStore,
  // Reducer
  gameReducer,
  type StateAction,
  // Handlers
  handleJoinSeat,
  handleLeaveMySeat,
  handleStartGame,
  handleRestartGame,
  handleSubmitAction,
  handleSubmitWolfVote,
  handleViewedRole,
  type Handler,
  type HandlerContext,
  type HandlerResult,
  // Intents
  type GameIntent,
} from './engine';

// =============================================================================
// Facade: 高层 API
// =============================================================================
export { GameFacade } from './facade';

// =============================================================================
// Protocol: 协议类型
// =============================================================================
export * from './protocol/types';
export * from './protocol/reasonCodes';

// =============================================================================
// Types: 共享类型
// =============================================================================
export { GameStatus, type LocalGameState, type LocalPlayer } from './types/GameStateTypes';
