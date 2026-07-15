/** Application composition root for infrastructure and the registered game catalog. */

import { CloudflareGameSessionFactory } from '@/app/CloudflareGameSessionFactory';
import type { ServiceContextValue } from '@/contexts/ServiceContext';
import { RoomCreationIntentStore } from '@/features/room/services/RoomCreationIntentStore';
import { RoomCreationService } from '@/features/room/services/RoomCreationService';
import { SettingsService } from '@/features/settings/services/SettingsService';
import { createClientGameCatalog } from '@/games/catalog';
import type { ClientGameCatalog } from '@/games/model/ClientGameCatalog';
import { CFAuthService } from '@/services/cloudflare/CFAuthService';
import { CFAvatarUploadService } from '@/services/cloudflare/CFAvatarUploadService';
import { CFRoomDirectoryService } from '@/services/cloudflare/CFRoomDirectoryService';
import { AudioService } from '@/services/infra/AudioService';
import { log } from '@/utils/logger';

export function createAppServices(): {
  readonly services: ServiceContextValue;
  readonly gameCatalog: ClientGameCatalog;
} {
  const authService = new CFAuthService();
  const roomDirectory = new CFRoomDirectoryService();
  const roomCreator = new RoomCreationService(roomDirectory, new RoomCreationIntentStore());
  const settingsService = new SettingsService();
  const audioService = new AudioService();
  const avatarUploadService = new CFAvatarUploadService();
  const sessionFactory = new CloudflareGameSessionFactory();

  const services: ServiceContextValue = {
    authService,
    roomDirectory,
    roomCreator,
    settingsService,
    audioService,
    avatarUploadService,
  };

  const gameCatalog = createClientGameCatalog({ sessionFactory, audioService });
  log.info('[init] All services created');
  return { services, gameCatalog };
}
