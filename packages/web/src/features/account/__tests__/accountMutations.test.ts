/** refreshSavedProfile: a refresh failure after a confirmed write is reported, an abort is not. */
import { refreshSavedProfile } from '../accountMutations';

vi.mock('@/utils/errorPipeline', () => ({ handleError: vi.fn() }));

describe('refreshSavedProfile', () => {
  it('confirms a refreshed saved profile', async () => {
    await expect(refreshSavedProfile(async () => undefined)).resolves.toBe(true);
  });

  it('reports a refresh failure separately from the already completed write', async () => {
    await expect(
      refreshSavedProfile(async () => {
        throw new TypeError('Failed to fetch');
      }),
    ).resolves.toBe(false);
  });

  it('does not continue room synchronization after authentication changes', async () => {
    await expect(
      refreshSavedProfile(async () => {
        throw new DOMException('Authentication changed', 'AbortError');
      }),
    ).rejects.toMatchObject({ name: 'AbortError' });
  });
});
