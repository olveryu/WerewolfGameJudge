/** Application composition root for infrastructure and the registered game catalog. */

import { CloudflareGameSessionFactory } from '@/app/CloudflareGameSessionFactory';
import type { ServiceContextValue } from '@/contexts/ServiceContext';
import { type ClientGameCatalog, createClientGameCatalog } from '@/games/catalog';
import { CFAuthService } from '@/services/cloudflare/CFAuthService';
import { CFRoomDirectoryService } from '@/services/cloudflare/CFRoomDirectoryService';
import { CFStorageService } from '@/services/cloudflare/CFStorageService';
import { SettingsService } from '@/services/feature/SettingsService';
import { AudioService } from '@/services/infra/AudioService';
import { log } from '@/utils/logger';

export function createAppServices(): {
  readonly services: ServiceContextValue;
  readonly gameCatalog: ClientGameCatalog;
} {
  const authService = new CFAuthService();
  const roomDirectory = new CFRoomDirectoryService();
  const settingsService = new SettingsService();
  const audioService = new AudioService();
  const avatarUploadService = new CFStorageService();
  const sessionFactory = new CloudflareGameSessionFactory();

  const services: ServiceContextValue = {
    authService,
    roomDirectory,
    settingsService,
    audioService,
    avatarUploadService,
  };

  const gameCatalog = createClientGameCatalog({ sessionFactory, audioService });
  log.info('[init] All services created');
  return { services, gameCatalog };
}
