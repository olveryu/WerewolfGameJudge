import { verifyAdminPassword } from '@/features/admin/services/adminApi';

jest.mock('@/features/admin/services/adminCredentialStore', () => ({
  readAdminCredential: jest.fn(() => 'credential'),
}));

const mockFetch = jest.fn<Promise<Response>, [RequestInfo | URL, RequestInit?]>();

describe('adminApi', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = mockFetch;
  });

  it.each([401, 403])('treats status %s as an invalid credential', async (status) => {
    mockFetch.mockResolvedValue(new Response(null, { status }));
    await expect(verifyAdminPassword('credential')).resolves.toBe(false);
  });

  it('surfaces non-authentication failures instead of reporting a bad password', async () => {
    mockFetch.mockResolvedValue(
      new Response(JSON.stringify({ success: false, reason: 'INTERNAL_ERROR' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    await expect(verifyAdminPassword('credential')).rejects.toThrow(
      'Admin API 500: INTERNAL_ERROR',
    );
  });

  it('rejects non-canonical credential input before making a request', async () => {
    await expect(verifyAdminPassword(' credential ')).rejects.toThrow('trimmed non-empty string');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
