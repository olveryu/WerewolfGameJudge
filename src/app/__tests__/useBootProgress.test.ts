/**
 * @jest-environment jsdom
 *
 * useBootProgress resource deadlines and request cleanup.
 */

import { act, renderHook } from '@testing-library/react-native/pure';
import * as Font from 'expo-font';
import { Platform } from 'react-native';

import { AVATAR_PREFETCH_TIMEOUT_MS, useBootProgress } from '@/app/useBootProgress';
import { useAuthContext, type User } from '@/contexts/AuthContext';

jest.mock('@expo/vector-icons/Ionicons', () => ({
  __esModule: true,
  default: { font: { ionicons: 'ionicons.ttf' } },
}));
jest.mock('expo-font', () => ({ loadAsync: jest.fn() }));
jest.mock('@/components/GeneratedAvatar', () => ({ isGeneratedAvatar: jest.fn(() => false) }));
jest.mock('@/contexts/AuthContext', () => ({ useAuthContext: jest.fn() }));
jest.mock('@/utils/avatar', () => ({
  getBuiltinAvatarId: jest.fn(),
  getBuiltinAvatarImage: jest.fn(),
  isBuiltinAvatarUrl: jest.fn(() => false),
}));
jest.mock('@/utils/logger', () => ({
  log: {
    extend: jest.fn(() => ({ debug: jest.fn(), warn: jest.fn() })),
  },
}));

interface FakeImage {
  src: string;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  removeAttribute: jest.Mock;
}

const mockUseAuthContext = jest.mocked(useAuthContext);
const mockFontLoadAsync = jest.mocked(Font.loadAsync);
const originalPlatformOS = Platform.OS;
const originalImage = window.Image;
const fakeImages: FakeImage[] = [];
const TEST_USER: User = {
  id: 'user-1',
  email: null,
  displayName: null,
  avatarUrl: 'https://cdn.example/avatar.webp',
  customAvatarUrl: null,
  avatarFrame: null,
  seatFlair: null,
  nameStyle: null,
  equippedEffect: null,
  seatAnimation: null,
  isAnonymous: false,
};

beforeEach(() => {
  jest.useFakeTimers();
  Object.defineProperty(Platform, 'OS', { value: 'web', configurable: true });
  Object.defineProperty(document, 'fonts', {
    value: { load: jest.fn(() => Promise.resolve([])) },
    configurable: true,
  });
  Object.defineProperty(window, 'Image', {
    value: jest.fn(() => {
      const image: FakeImage = {
        src: '',
        onload: null,
        onerror: null,
        removeAttribute: jest.fn(),
      };
      fakeImages.push(image);
      return image;
    }),
    configurable: true,
  });
  mockFontLoadAsync.mockResolvedValue(undefined);
  mockUseAuthContext.mockReturnValue({
    user: TEST_USER,
    loading: false,
    error: null,
    isAuthenticated: true,
    needsWechatLogin: false,
    refreshUser: jest.fn<Promise<void>, []>().mockResolvedValue(undefined),
    retryInit: jest.fn(),
  });
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
  jest.clearAllMocks();
  fakeImages.length = 0;
  Object.defineProperty(Platform, 'OS', { value: originalPlatformOS, configurable: true });
  Object.defineProperty(window, 'Image', { value: originalImage, configurable: true });
});

it('continues boot and releases the request when avatar prefetch never settles', async () => {
  const { result, unmount } = renderHook(() => useBootProgress());

  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
  expect(result.current.isReady).toBe(false);
  expect(fakeImages).toHaveLength(1);

  act(() => {
    jest.advanceTimersByTime(AVATAR_PREFETCH_TIMEOUT_MS - 1);
  });
  expect(result.current.isReady).toBe(false);

  act(() => {
    jest.advanceTimersByTime(1);
  });
  expect(result.current.isReady).toBe(true);
  expect(fakeImages[0]!.removeAttribute).toHaveBeenCalledWith('src');
  expect(fakeImages[0]!.onload).toBeNull();
  expect(fakeImages[0]!.onerror).toBeNull();

  unmount();
});
