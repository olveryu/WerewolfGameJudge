/** Application composition root: creates the infrastructure services once per page load. */
import type { ServiceContextValue } from '@/contexts/ServiceContext';
import { apiClient, authTokenStore } from '@/platform/http/client';
import { createInboxWakeSignal } from '@/platform/inbox/inboxWake';
import { CFAuthService } from '@/services/cloudflare/CFAuthService';
import { CFAvatarUploadService } from '@/services/cloudflare/CFAvatarUploadService';
import { CFRoomDirectoryService } from '@/services/cloudflare/CFRoomDirectoryService';

/** Builds the services provided through `ServiceProvider`. */
export function createAppServices(): ServiceContextValue {
  return {
    authService: new CFAuthService({ apiClient, tokens: authTokenStore }),
    roomDirectory: new CFRoomDirectoryService(),
    avatarUploadService: new CFAvatarUploadService(),
    inboxWakes: createInboxWakeSignal(),
  };
}
