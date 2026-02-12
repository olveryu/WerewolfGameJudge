/**
 * ServiceContext - Composition root DI for infrastructure & feature services
 *
 * 由 App.tsx 组合根统一创建 service 实例并通过 Context 注入，
 * 消除 getInstance() 单例模式的隐式依赖。
 *
 * ✅ 允许：创建 Context + Provider、useServices hook
 * ❌ 禁止：业务逻辑、创建 service 实例（由 composition root 负责）
 */
import React, { createContext, use, useMemo } from 'react';

import type { AvatarUploadService } from '@/services/feature/AvatarUploadService';
import type { SettingsService } from '@/services/feature/SettingsService';
import type { AudioService } from '@/services/infra/AudioService';
import type { AuthService } from '@/services/infra/AuthService';
import type { RoomService } from '@/services/infra/RoomService';

export interface ServiceContextValue {
  authService: AuthService;
  roomService: RoomService;
  settingsService: SettingsService;
  audioService: AudioService;
  avatarUploadService: AvatarUploadService;
}

const ServiceContext = createContext<ServiceContextValue | null>(null);

interface ServiceProviderProps {
  children: React.ReactNode;
  services: ServiceContextValue;
}

export const ServiceProvider: React.FC<ServiceProviderProps> = ({ children, services }) => {
  const value = useMemo(() => services, [services]);
  return <ServiceContext.Provider value={value}>{children}</ServiceContext.Provider>;
};

export const useServices = (): ServiceContextValue => {
  const ctx = use(ServiceContext);
  if (!ctx) {
    throw new Error('[useServices] Missing <ServiceProvider> in component tree');
  }
  return ctx;
};
