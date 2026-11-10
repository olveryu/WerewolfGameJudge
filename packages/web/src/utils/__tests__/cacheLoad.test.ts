import { describe, expect, it, vi } from 'vitest';

import { cacheLoad } from '@/utils/cacheLoad';

describe('cacheLoad', () => {
  it('returns the same promise and loads once while the load is pending or fulfilled', async () => {
    const load = vi.fn(() => Promise.resolve('module'));
    const cached = cacheLoad(load);

    const first = cached();
    expect(cached()).toBe(first);
    await expect(first).resolves.toBe('module');
    expect(cached()).toBe(first);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('drops a rejected load so the next call starts a new attempt', async () => {
    const failure = new Error('chunk failed');
    const load = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(failure)
      .mockResolvedValueOnce('module');
    const cached = cacheLoad(load);

    const failed = cached();
    await expect(failed).rejects.toBe(failure);

    const retried = cached();
    expect(retried).not.toBe(failed);
    await expect(retried).resolves.toBe('module');
    expect(cached()).toBe(retried);
    expect(load).toHaveBeenCalledTimes(2);
  });
});
