/** Application composition root: creates the infrastructure services once per page load. */
import type { ServiceContextValue } from '@/contexts/ServiceContext';
import { RoomCreationIntentStore } from '@/features/room/services/RoomCreationIntentStore';
import { RoomCreationService } from '@/features/room/services/RoomCreationService';
import { apiClient, authTokenStore } from '@/platform/http/client';
import { createInboxWakeSignal } from '@/platform/inbox/inboxWake';
import type { RoomLinkFactory } from '@/platform/realtime/RoomLinkFactory';
import { CFAuthService } from '@/services/cloudflare/CFAuthService';
import { CFAvatarUploadService } from '@/services/cloudflare/CFAvatarUploadService';
import { CFRoomDirectoryService } from '@/services/cloudflare/CFRoomDirectoryService';

/** Caches one lazy load; a failed chunk load may succeed on retry, so only a created value stays cached. */
function cacheLoad<T>(load: () => Promise<T>): () => Promise<T> {
  let loading: Promise<T> | null = null;
  return () => {
    if (loading !== null) return loading;
    const attempt = load();
    loading = attempt;
    attempt.catch(() => {
      loading = null;
    });
    return attempt;
  };
}

/** Builds the services provided through `ServiceProvider`. */
function createAppServices(): ServiceContextValue {
  const roomDirectory = new CFRoomDirectoryService();
  const inboxWakes = createInboxWakeSignal();
  // The realtime stack loads with the first room, outside the home start-up budget.
  let loadedRoomLinks: RoomLinkFactory | null = null;
  const loadRoomLinks = cacheLoad(async () => {
    const { createRoomLinkFactory } = await import('@/platform/realtime/RoomLinkFactory');
    loadedRoomLinks = createRoomLinkFactory({
      onInboxWake: (reason) => inboxWakes.emit(reason),
    });
    return loadedRoomLinks;
  });
  // Audio loads with the first room module too, which registers the gesture unlock then. Narration
  // only starts from the host's in-room 开始游戏 tap, which the loaded module renders, so that tap
  // (or any earlier in-room tap) is the gesture that unlocks it.
  const loadAudioService = cacheLoad(async () => {
    const { AudioService } = await import('@/services/infra/AudioService');
    return new AudioService();
  });
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
