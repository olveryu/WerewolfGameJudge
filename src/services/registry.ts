/**
 * ServiceRegistry - 服务工厂，实例化 Cloudflare Workers 基础服务
 *
 * 由 App.tsx composition root 调用一次，不含业务逻辑。
 */

import { GameStore } from '@werewolf/game-engine/engine/store';

import type { ServiceContextValue } from '@/contexts/ServiceContext';
import { CFAuthService } from '@/services/cloudflare/CFAuthService';
import { CFRealtimeService } from '@/services/cloudflare/CFRealtimeService';
import { CFRoomService } from '@/services/cloudflare/CFRoomService';
import { CFStorageService } from '@/services/cloudflare/CFStorageService';
import { GameFacade } from '@/services/facade/GameFacade';
import { SettingsService } from '@/services/feature/SettingsService';
import { AudioService } from '@/services/infra/AudioService';
import type { IGameFacade } from '@/services/types/IGameFacade';
import type { IRealtimeService } from '@/services/types/IRealtimeService';

/**
 * 顶层入口：创建全部 services + facade。
 * App.tsx composition root 调用一次。
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
  const realtimeService: IRealtimeService = new CFRealtimeService();

  const services: ServiceContextValue = {
    authService,
    roomService,
    settingsService,
    audioService,
    avatarUploadService,
  };

  const facade = new GameFacade({
    store: new GameStore(),
    realtimeService,
    audioService,
    roomService,
  });

  return { services, facade };
}
