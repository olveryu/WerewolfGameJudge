export { default as AudioService } from './infra/AudioService';
export { AuthService } from './infra/AuthService';
export { AvatarUploadService } from './infra/AvatarUploadService';

// New Broadcast Architecture (Host as Authority)
export {
  BroadcastService,
  type HostBroadcast,
  type PlayerMessage,
  type BroadcastGameState,
  type BroadcastPlayer,
} from './transport/BroadcastService';
export {
  GameStatus,
  type LocalGameState,
  type LocalPlayer,
} from './types/GameStateTypes';
export { SimplifiedRoomService, type RoomRecord } from './infra/RoomService';

// Facade
export { V2GameFacade } from './facade';
