/**
 * ServiceRegistry - service factory that instantiates Cloudflare Workers foundation services
 *
 * Called once by the App.tsx composition root; contains no business logic.
 */

import { FibStore } from '@werewolf/game-engine/fibking/store/FibStore';
import type { FibState } from '@werewolf/game-engine/fibking/types';
import type { WerewolfState } from '@werewolf/game-engine/werewolf/protocol/types';
import { WerewolfStore } from '@werewolf/game-engine/werewolf/store';

import type { ServiceContextValue } from '@/contexts/ServiceContext';
import { CFAuthService } from '@/services/cloudflare/CFAuthService';
import { CFRealtimeService } from '@/services/cloudflare/CFRealtimeService';
import { CFRoomService } from '@/services/cloudflare/CFRoomService';
import { CFStorageService } from '@/services/cloudflare/CFStorageService';
import { ConnectionManager } from '@/services/connection/ConnectionManager';
import { SettingsService } from '@/services/feature/SettingsService';
import { FibFacade } from '@/services/games/fibking/FibFacade';
import type { IWerewolfFacade } from '@/services/games/werewolf/IWerewolfFacade';
import { WerewolfFacade } from '@/services/games/werewolf/WerewolfFacade';
import { AudioService } from '@/services/infra/AudioService';
import { log } from '@/utils/logger';

/**
 * Top-level entry point: creates all services and the facade.
 * Called once by the App.tsx composition root.
 */
export function createAllServices(): {
  services: ServiceContextValue;
  werewolfFacade: IWerewolfFacade;
  fibFacade: FibFacade;
} {
  const authService = new CFAuthService();
  const roomService = new CFRoomService();
  const settingsService = new SettingsService();
  const audioService = new AudioService();
  // CFStorageService reads token from cfFetch's tokenProvider (set by CFAuthService constructor)
  const avatarUploadService = new CFStorageService();

  const store = new WerewolfStore();
  const transport = new CFRealtimeService<WerewolfState>();

  // onSettleResult callback reads `werewolfFacade` via closure at call time (not declaration time),
  // so the forward reference is safe — facade is initialized before any WS message arrives.
  const connectionManager = new ConnectionManager<WerewolfState>({
    transport,
    fetchStateFromDB: async (roomCode) => roomService.getGameState<WerewolfState>(roomCode),
    getStateRevision: async (roomCode) => roomService.getStateRevision(roomCode),
    onStateUpdate: (state, revision, lastAction) =>
      store.applySnapshot(state, revision, lastAction),
    onFetchedState: (state, revision) => store.applySnapshot(state, revision),
    onSettleResult: (result) => werewolfFacade.handleSettleResult(result),
  });

  const services: ServiceContextValue = {
    authService,
    roomService,
    settingsService,
    audioService,
    avatarUploadService,
  };

  const werewolfFacade = new WerewolfFacade({
    store,
    connectionManager,
    audioService,
    roomService,
  });

  // ── fibking: typed room adapter over the shared connection stack ──
  const fibStore = new FibStore();
  const fibTransport = new CFRealtimeService<FibState>();
  const fibConnectionManager = new ConnectionManager<FibState>({
    transport: fibTransport,
    // /room/state and /room/revision are game-agnostic; the blob is a FibState at runtime.
    fetchStateFromDB: (roomCode) => roomService.getGameState<FibState>(roomCode),
    getStateRevision: (roomCode) => roomService.getStateRevision(roomCode),
    onStateUpdate: (state, revision, lastAction) =>
      fibStore.applySnapshot(state, revision, lastAction),
    onFetchedState: (state, revision) => fibStore.applySnapshot(state, revision),
  });
  const fibFacade = new FibFacade({
    store: fibStore,
    connectionManager: fibConnectionManager,
    roomService,
  });

  log.info('[init] All services created');

  return { services, werewolfFacade, fibFacade };
}
