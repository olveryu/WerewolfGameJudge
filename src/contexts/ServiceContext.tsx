/**
 * ServiceContext - Composition root DI for infrastructure & feature services
 *
 * The App.tsx composition root creates service instances and injects them via Context,
 * eliminating the implicit dependencies of the getInstance() singleton pattern. Provides Context + Provider and the useServices hook.
 * No business logic, no service instance creation (handled by the composition root).
 */
import type React from 'react';
import { createContext, use, useMemo } from 'react';

import type { RoomCreator, RoomDirectory } from '@/features/room/model/RoomDirectory';
import type { SettingsService } from '@/services/feature/SettingsService';
import type { AudioService } from '@/services/infra/AudioService';
import type { IAuthService } from '@/services/types/IAuthService';
import type { IAvatarUploadService } from '@/services/types/IAvatarUploadService';

/** Set of service instances provided by the DI container. */
export interface ServiceContextValue {
  authService: IAuthService;
  roomDirectory: RoomDirectory;
  roomCreator: RoomCreator;
  settingsService: SettingsService;
  audioService: AudioService;
  avatarUploadService: IAvatarUploadService;
}

const ServiceContext = createContext<ServiceContextValue | null>(null);

interface ServiceProviderProps {
  children: React.ReactNode;
  services: ServiceContextValue;
}

/** Service injection Provider; wraps the entire component tree in App.tsx composition root. */
export const ServiceProvider: React.FC<ServiceProviderProps> = ({ children, services }) => {
  const value = useMemo(() => services, [services]);
  return <ServiceContext value={value}>{children}</ServiceContext>;
};

/**
 * Get the global service instances.
 *
 * Must be called inside the ServiceProvider subtree; otherwise it throws.
 */
export const useServices = (): ServiceContextValue => {
  const ctx = use(ServiceContext);
  if (!ctx) {
    throw new Error('[useServices] Missing <ServiceProvider> in component tree');
  }
  return ctx;
};
