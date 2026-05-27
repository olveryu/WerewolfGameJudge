/**
 * ServiceRegistry - service factory that instantiates Cloudflare Workers foundation services
 *
 * Called once by the App.tsx composition root; contains no business logic.
 */

import { GameStore } from '@werewolf/game-engine/engine/store';

import type { ServiceContextValue } from '@/contexts/ServiceContext';
import { CFAuthService } from '@/services/cloudflare/CFAuthService';
import { CFRealtimeService } from '@/services/cloudflare/CFRealtimeService';
import { CFRoomService } from '@/services/cloudflare/CFRoomService';
import { CFStorageService } from '@/services/cloudflare/CFStorageService';
import { ConnectionManager } from '@/services/connection/ConnectionManager';
import { GameFacade } from '@/services/facade/GameFacade';
import { SettingsService } from '@/services/feature/SettingsService';
import { AudioService } from '@/services/infra/AudioService';
import type { IGameFacade } from '@/services/types/IGameFacade';
import { log } from '@/utils/logger';

/**
 * Top-level entry point: creates all services and the facade.
 * Called once by the App.tsx composition root.
 */
export function createAllServices(): {
  services: ServiceContextValue;
  facade: IGameFacade;
} {
  const authService = new CFAuthService();
  const roomService = new CFRoomService();
  const settingsService = new SettingsService();
  const audioService = new AudioService();
  // CFStorageService reads token from cfFetch's tokenProvider (set by CFAuthService constructor)
  const avatarUploadService = new CFStorageService();

  const store = new GameStore();
  const transport = new CFRealtimeService();

  // onSettleResult callback reads `facade` via closure at call time (not declaration time),
  // so the forward reference is safe — facade is initialized before any WS message arrives.
  const connectionManager = new ConnectionManager({
    transport,
    fetchStateFromDB: async (roomCode) => roomService.getGameState(roomCode),
    getStateRevision: async (roomCode) => roomService.getStateRevision(roomCode),
    onStateUpdate: (state, revision, lastAction) =>
      store.applySnapshot(state, revision, lastAction),
    onFetchedState: (state, revision) => store.applySnapshot(state, revision),
    onSettleResult: (result) => facade.handleSettleResult(result),
  });

  const services: ServiceContextValue = {
    authService,
    roomService,
    settingsService,
    audioService,
    avatarUploadService,
  };

  const facade = new GameFacade({
    store,
    connectionManager,
    audioService,
    roomService,
  });

  log.info('[init] All services created');

  return { services, facade };
}
