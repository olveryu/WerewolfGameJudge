/**
 * Shared mock service factories for tests that need ServiceProvider.
 *
 * Usage in test files:
 *   import { createMockServices, MockServiceProvider } from '@/__tests__/helpers/mockServices';
 */
import type { ServiceContextValue } from '@/contexts/ServiceContext';

/** Create a fully-mocked ServiceContextValue for testing */
export function createMockServices(overrides?: Partial<ServiceContextValue>): ServiceContextValue {
  return {
    authService: {
      waitForInit: jest.fn().mockResolvedValue(undefined),
      getCurrentUserId: jest.fn().mockReturnValue('test-uid'),
      getCurrentUser: jest.fn().mockResolvedValue({ data: { user: null } }),
      getCurrentDisplayName: jest.fn().mockResolvedValue('Test User'),
      getCurrentAvatarUrl: jest.fn().mockResolvedValue(null),
      autoSignIn: jest.fn().mockResolvedValue(undefined),
      signInAnonymously: jest.fn().mockResolvedValue({ data: null, error: null }),
      signOut: jest.fn().mockResolvedValue(undefined),
      updateProfile: jest.fn().mockResolvedValue({ data: null, error: null }),
      onAuthStateChange: jest
        .fn()
        .mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } }),
    } as unknown as ServiceContextValue['authService'],

    roomService: {
      createRoom: jest
        .fn()
        .mockResolvedValue({ roomNumber: '1234', hostUid: 'test-uid', createdAt: new Date() }),
      getRoom: jest
        .fn()
        .mockResolvedValue({ roomNumber: '1234', hostUid: 'test-uid', createdAt: new Date() }),
      deleteRoom: jest.fn().mockResolvedValue(undefined),
    } as unknown as ServiceContextValue['roomService'],

    settingsService: {
      load: jest.fn().mockResolvedValue(undefined),
      getRoleRevealAnimation: jest.fn().mockReturnValue('random'),
      setRoleRevealAnimation: jest.fn(),
      isBgmEnabled: jest.fn().mockReturnValue(true),
      toggleBgm: jest.fn().mockResolvedValue(false),
      getThemeKey: jest.fn().mockReturnValue('dark'),
      setThemeKey: jest.fn(),
      addListener: jest.fn().mockReturnValue(jest.fn()),
    } as unknown as ServiceContextValue['settingsService'],

    audioService: {
      playNightAudio: jest.fn().mockResolvedValue(undefined),
      playNightEndAudio: jest.fn().mockResolvedValue(undefined),
      playRoleBeginningAudio: jest.fn().mockResolvedValue(undefined),
      playRoleEndingAudio: jest.fn().mockResolvedValue(undefined),
      preloadForRoles: jest.fn().mockResolvedValue(undefined),
      clearPreloaded: jest.fn(),
      cleanup: jest.fn(),
      startBgm: jest.fn().mockResolvedValue(undefined),
      stopBgm: jest.fn(),
    } as unknown as ServiceContextValue['audioService'],

    avatarUploadService: {
      uploadAvatar: jest.fn().mockResolvedValue(null),
    } as unknown as ServiceContextValue['avatarUploadService'],

    ...overrides,
  };
}
