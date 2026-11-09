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

/** Builds the services provided through `ServiceProvider`. */
export function createAppServices(): ServiceContextValue {
  const roomDirectory = new CFRoomDirectoryService();
  const inboxWakes = createInboxWakeSignal();
  // The realtime stack loads with the first room, outside the home start-up budget.
  let roomLinks: Promise<RoomLinkFactory> | null = null;
  const loadRoomLinks = (): Promise<RoomLinkFactory> => {
    if (roomLinks !== null) return roomLinks;
    const loading = import('@/platform/realtime/RoomLinkFactory').then(
      ({ createRoomLinkFactory }) =>
        createRoomLinkFactory({ onInboxWake: (reason) => inboxWakes.emit(reason) }),
    );
    roomLinks = loading;
    // A failed chunk load may succeed on retry; only a created factory stays cached.
    loading.catch(() => {
      roomLinks = null;
    });
    return loading;
  };
  return {
    authService: new CFAuthService({ apiClient, tokens: authTokenStore }),
    roomDirectory,
    roomCreator: new RoomCreationService(roomDirectory, new RoomCreationIntentStore()),
    loadRoomLinks,
    avatarUploadService: new CFAvatarUploadService(),
    inboxWakes,
  };
}
