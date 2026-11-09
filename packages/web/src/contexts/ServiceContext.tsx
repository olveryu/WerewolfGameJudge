/**
 * ServiceContext — dependency injection for the services the composition root
 * (`app/services.ts`) creates. Holds no logic and creates nothing.
 */
import type React from 'react';
import { createContext, use } from 'react';

import type { RoomCreator, RoomDirectory } from '@/features/room/model/RoomDirectory';
import type { InboxWakeSignal } from '@/platform/inbox/inboxWake';
import type { RoomLinkFactory } from '@/platform/realtime/RoomLinkFactory';
import type { IAuthService } from '@/services/types/IAuthService';
import type { IAvatarUploadService } from '@/services/types/IAvatarUploadService';

/** Service instances provided to the component tree. */
export interface ServiceContextValue {
  authService: IAuthService;
  roomDirectory: RoomDirectory;
  roomCreator: RoomCreator;
  /** One shared lease and outbox for every game's room link. */
  roomLinks: RoomLinkFactory;
  avatarUploadService: IAvatarUploadService;
  /** Room links emit on `live` and INBOX_HINT; the account inbox consumer drains on it. */
  inboxWakes: InboxWakeSignal;
}

const ServiceContext = createContext<ServiceContextValue | null>(null);

/** Provides the composition root's services to the tree. */
export function ServiceProvider({
  children,
  services,
}: {
  children: React.ReactNode;
  services: ServiceContextValue;
}) {
  return <ServiceContext value={services}>{children}</ServiceContext>;
}

/**
 * Returns the app's services.
 *
 * @throws when called outside `ServiceProvider`
 */
export function useServices(): ServiceContextValue {
  const services = use(ServiceContext);
  if (!services) {
    throw new Error('useServices must be used within a ServiceProvider');
  }
  return services;
}
