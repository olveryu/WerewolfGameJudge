/**
 * AvatarUploadService configured-state tests.
 *
 * Exercises the upload flow, compression fallback, old-avatar cleanup,
 * and error paths when Supabase is available.
 * Uses separate module mock from AvatarUploadService.test.ts which covers
 * the unconfigured state.
 */

// ---- Mocks ----
const mockUpload = jest.fn();
const mockList = jest.fn();
const mockRemove = jest.fn();
const mockGetPublicUrl = jest.fn();

jest.mock('@/services/infra/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  supabase: {
    storage: {
      from: () => ({
        upload: mockUpload,
        list: mockList,
        remove: mockRemove,
        getPublicUrl: mockGetPublicUrl,
      }),
    },
  },
}));

jest.mock('../../../utils/logger', () => ({
  log: { extend: () => ({ debug: jest.fn(), warn: jest.fn(), error: jest.fn() }) },
}));

jest.mock('@werewolf/game-engine/utils/id', () => ({
  randomHex: () => 'aabbccdd',
}));

// Mock fetch for compressImage fallback (no DOM in jest)
const mockFetchBlob = new Blob(['test-image'], { type: 'image/jpeg' });
global.fetch = jest.fn().mockResolvedValue({
  blob: () => Promise.resolve(mockFetchBlob),
}) as any;

import { AvatarUploadService } from '@/services/feature/AvatarUploadService';
import type { AuthService } from '@/services/infra/AuthService';

const mockGetCurrentUserId = jest.fn();
const mockUpdateProfile = jest.fn().mockResolvedValue(undefined);

const mockAuthService = {
  getCurrentUserId: mockGetCurrentUserId,
  updateProfile: mockUpdateProfile,
} as unknown as AuthService;

const createService = () => new AvatarUploadService(mockAuthService);

// ---- Tests ----

describe('AvatarUploadService - Configured state', () => {
  let service: AvatarUploadService;

  beforeEach(() => {
    service = createService();
    jest.clearAllMocks();
    // Re-wire fetch default
    (global.fetch as jest.Mock).mockResolvedValue({
      blob: () => Promise.resolve(mockFetchBlob),
    });
  });

  // --- Happy path ---

  it('uploadAvatar full flow: list → compress → upload → publicUrl → updateProfile → cleanup', async () => {
    mockGetCurrentUserId.mockReturnValue('user-1');
    mockList.mockResolvedValue({ data: [{ name: 'old-avatar.jpg' }], error: null });
    mockUpload.mockResolvedValue({ data: { path: 'user-1/new.jpg' }, error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://cdn.example.com/user-1/new.jpg' },
    });
    mockRemove.mockResolvedValue({ error: null });

    const url = await service.uploadAvatar('file:///photo.jpg');

    expect(url).toBe('https://cdn.example.com/user-1/new.jpg');
    // compressImage fell back to fetch (no DOM)
    expect(global.fetch).toHaveBeenCalledWith('file:///photo.jpg');
    // upload called with blob
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringContaining('user-1/'),
      mockFetchBlob,
      expect.objectContaining({ contentType: 'image/jpeg' }),
    );
    // profile updated
    expect(mockUpdateProfile).toHaveBeenCalledWith({
      avatarUrl: 'https://cdn.example.com/user-1/new.jpg',
    });
    // old avatars cleaned up
    expect(mockRemove).toHaveBeenCalledWith(['user-1/old-avatar.jpg']);
  });

  // --- Auth guard ---

  it('should throw when not logged in', async () => {
    mockGetCurrentUserId.mockReturnValue(null);

    await expect(service.uploadAvatar('file:///photo.jpg')).rejects.toThrow('请先登录');
  });

  // --- Upload error ---

  it('should propagate upload error from supabase', async () => {
    mockGetCurrentUserId.mockReturnValue('user-1');
    mockList.mockResolvedValue({ data: [], error: null });
    mockUpload.mockResolvedValue({ data: null, error: new Error('quota exceeded') });

    await expect(service.uploadAvatar('file:///photo.jpg')).rejects.toThrow('quota exceeded');
  });

  // --- listUserAvatars error → returns [] ---

  it('listUserAvatars should return empty array on error', async () => {
    mockGetCurrentUserId.mockReturnValue('user-1');
    mockList.mockResolvedValue({ data: null, error: new Error('network') });
    mockUpload.mockResolvedValue({ data: { path: 'user-1/new.jpg' }, error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://cdn.example.com/user-1/new.jpg' },
    });

    // Should succeed even though list failed (old files = [])
    const url = await service.uploadAvatar('file:///photo.jpg');
    expect(url).toBe('https://cdn.example.com/user-1/new.jpg');
    // No cleanup attempted since old list is empty
    expect(mockRemove).not.toHaveBeenCalled();
  });

  // --- deleteOldAvatars best-effort ---

  it('deleteOldAvatars should not throw when remove fails', async () => {
    mockGetCurrentUserId.mockReturnValue('user-1');
    mockList.mockResolvedValue({
      data: [{ name: 'old1.jpg' }, { name: 'old2.jpg' }],
      error: null,
    });
    mockUpload.mockResolvedValue({ data: { path: 'user-1/new.jpg' }, error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: 'https://cdn.example.com/user-1/new.jpg' },
    });
    mockRemove.mockResolvedValue({ error: new Error('storage error') });

    // Should still return the URL despite cleanup failure
    const url = await service.uploadAvatar('file:///photo.jpg');
    expect(url).toBe('https://cdn.example.com/user-1/new.jpg');
  });

  // --- deleteOldAvatars skip when new file matches old file ---

  it('deleteOldAvatars should not delete the newly uploaded file', async () => {
    mockGetCurrentUserId.mockReturnValue('user-1');
    // The old list includes what will be the new file name
    const nowTs = Date.now();
    jest.spyOn(Date, 'now').mockReturnValue(nowTs);
    const expectedFileName = `user-1/${nowTs}-aabbccdd.jpg`;

    mockList.mockResolvedValue({
      data: [{ name: `${nowTs}-aabbccdd.jpg` }],
      error: null,
    });
    mockUpload.mockResolvedValue({ data: { path: expectedFileName }, error: null });
    mockGetPublicUrl.mockReturnValue({
      data: { publicUrl: `https://cdn.example.com/${expectedFileName}` },
    });
    mockRemove.mockResolvedValue({ error: null });

    await service.uploadAvatar('file:///photo.jpg');

    // The toDelete list should exclude the new file → nothing to delete
    expect(mockRemove).not.toHaveBeenCalled();

    jest.restoreAllMocks();
  });
});
