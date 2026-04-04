/**
 * ServiceRegistry - 服务工厂，根据后端配置实例化基础服务
 *
 * 读取 EXPO_PUBLIC_BACKEND env flag（'supabase' | 'cloudflare'）决定使用哪套实现。
 * 由 App.tsx composition root 调用，不含业务逻辑。
 */

import { GameStore } from '@werewolf/game-engine/engine/store';

import type { ServiceContextValue } from '@/contexts/ServiceContext';
import { CFAuthService } from '@/services/cloudflare/CFAuthService';
import { CFRealtimeService } from '@/services/cloudflare/CFRealtimeService';
import { CFRoomService } from '@/services/cloudflare/CFRoomService';
import { CFStorageService } from '@/services/cloudflare/CFStorageService';
import { GameFacade } from '@/services/facade/GameFacade';
import { AvatarUploadService } from '@/services/feature/AvatarUploadService';
import { SettingsService } from '@/services/feature/SettingsService';
import { AudioService } from '@/services/infra/AudioService';
import { AuthService } from '@/services/infra/AuthService';
import { RoomService } from '@/services/infra/RoomService';
import { RealtimeService } from '@/services/transport/RealtimeService';
import type { IAuthService } from '@/services/types/IAuthService';
import type { IGameFacade } from '@/services/types/IGameFacade';
import type { IRealtimeService } from '@/services/types/IRealtimeService';
import type { IRoomService } from '@/services/types/IRoomService';
import type { IStorageService } from '@/services/types/IStorageService';

type BackendType = 'supabase' | 'cloudflare';

const BACKEND: BackendType =
  (process.env.EXPO_PUBLIC_BACKEND as BackendType | undefined) ?? 'supabase';

/** 创建基础服务实例（auth / room / realtime / storage / settings / audio） */
function createSupabaseServices(): {
  services: ServiceContextValue;
  realtimeService: IRealtimeService;
} {
  const authService: IAuthService = new AuthService();
  const roomService: IRoomService = new RoomService();
  const settingsService = new SettingsService();
  const audioService = new AudioService();
  const avatarUploadService: IStorageService = new AvatarUploadService(authService);
  const realtimeService: IRealtimeService = new RealtimeService();

  return {
    services: { authService, roomService, settingsService, audioService, avatarUploadService },
    realtimeService,
  };
}

/** 创建 Cloudflare Workers 基础服务实例 */
function createCloudflareServices(): {
  services: ServiceContextValue;
  realtimeService: IRealtimeService;
} {
  const authService: IAuthService = new CFAuthService();
  const roomService: IRoomService = new CFRoomService();
  const settingsService = new SettingsService();
  const audioService = new AudioService();
  // CFStorageService reads token from cfFetch's tokenProvider (set by CFAuthService constructor)
  const avatarUploadService: IStorageService = new CFStorageService();
  const realtimeService: IRealtimeService = new CFRealtimeService();

  return {
    services: { authService, roomService, settingsService, audioService, avatarUploadService },
    realtimeService,
  };
}

/** 创建 GameFacade（依赖基础服务） */
function createFacade(
  services: ServiceContextValue,
  realtimeService: IRealtimeService,
): IGameFacade {
  return new GameFacade({
    store: new GameStore(),
    realtimeService,
    audioService: services.audioService,
    roomService: services.roomService,
  });
}

/**
 * 顶层入口：创建全部 services + facade。
 * App.tsx composition root 调用一次。
 */
export function createAllServices(): {
  services: ServiceContextValue;
  facade: IGameFacade;
} {
  if (BACKEND === 'cloudflare') {
    const { services, realtimeService } = createCloudflareServices();
    const facade = createFacade(services, realtimeService);
    return { services, facade };
  }

  const { services, realtimeService } = createSupabaseServices();
  const facade = createFacade(services, realtimeService);
  return { services, facade };
}
