/** Application composition root: creates the infrastructure services once per page load. */
import type { ServiceContextValue } from '@/contexts/ServiceContext';
import { RoomCreationIntentStore } from '@/features/room/services/RoomCreationIntentStore';
import { RoomCreationService } from '@/features/room/services/RoomCreationService';
import { apiClient, authTokenStore } from '@/platform/http/client';
import { createInboxWakeSignal } from '@/platform/inbox/inboxWake';
import { createRoomLinkFactory } from '@/platform/realtime/RoomLinkFactory';
import { CFAuthService } from '@/services/cloudflare/CFAuthService';
import { CFAvatarUploadService } from '@/services/cloudflare/CFAvatarUploadService';
import { CFRoomDirectoryService } from '@/services/cloudflare/CFRoomDirectoryService';

/** Builds the services provided through `ServiceProvider`. */
export function createAppServices(): ServiceContextValue {
  const roomDirectory = new CFRoomDirectoryService();
  const inboxWakes = createInboxWakeSignal();
  return {
    authService: new CFAuthService({ apiClient, tokens: authTokenStore }),
    roomDirectory,
    roomCreator: new RoomCreationService(roomDirectory, new RoomCreationIntentStore()),
    roomLinks: createRoomLinkFactory({ onInboxWake: (reason) => inboxWakes.emit(reason) }),
    avatarUploadService: new CFAvatarUploadService(),
    inboxWakes,
  };
}
