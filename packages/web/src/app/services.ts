/** Application composition root: creates the infrastructure services once per page load. */
import type { ServiceContextValue } from '@/contexts/ServiceContext';
import { RoomCreationIntentStore } from '@/features/room/services/RoomCreationIntentStore';
import { RoomCreationService } from '@/features/room/services/RoomCreationService';
import { apiClient, authTokenStore } from '@/platform/http/client';
import { createInboxWakeSignal } from '@/platform/inbox/inboxWake';
import { createRoomLinkFactory, type RoomLinkFactory } from '@/platform/realtime/RoomLinkFactory';
import { CFAuthService } from '@/services/cloudflare/CFAuthService';
import { CFAvatarUploadService } from '@/services/cloudflare/CFAvatarUploadService';
import { CFRoomDirectoryService } from '@/services/cloudflare/CFRoomDirectoryService';
import { AudioService } from '@/services/infra/AudioService';
import { cacheLoad } from '@/utils/cacheLoad';

/** Builds the services provided through `ServiceProvider`. */
function createAppServices(): ServiceContextValue {
  const roomDirectory = new CFRoomDirectoryService();
  const inboxWakes = createInboxWakeSignal();
  // Code is eager; links are instantiated only when the first room needs them.
  let loadedRoomLinks: RoomLinkFactory | null = null;
  const loadRoomLinks = cacheLoad(async () => {
    loadedRoomLinks = createRoomLinkFactory({
      onInboxWake: (reason) => inboxWakes.emit(reason),
    });
    return loadedRoomLinks;
  });
  // Retain first-room initialization and the existing audio gesture-unlock lifecycle.
  const loadAudioService = cacheLoad(async () => new AudioService());
  return {
    authService: new CFAuthService({ apiClient, tokens: authTokenStore }),
    roomDirectory,
    roomCreator: new RoomCreationService(roomDirectory, new RoomCreationIntentStore()),
    loadRoomLinks,
    // Before the factory loads no link exists, so there is nothing to release.
    releaseRoomLinksOutside: (scope) => loadedRoomLinks?.releaseOutside(scope),
    loadAudioService,
    avatarUploadService: new CFAvatarUploadService(),
    inboxWakes,
  };
}

let appServices: ServiceContextValue | null = null;

/**
 * The page's services, created on first call. Construction starts the session restore, so it
 * must not run in a render-time initializer that StrictMode invokes twice.
 */
export function getAppServices(): ServiceContextValue {
  appServices ??= createAppServices();
  return appServices;
}
