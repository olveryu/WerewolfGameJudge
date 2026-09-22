/** Provider transport uses separate material, strict output, and redacted failures. */
import { describe, expect, it, vi } from 'vitest';

import { createUndercoverWordProvider } from '../wordProvider';

describe('Undercover provider', () => {
  it('submits a bounded structured request and accepts a real zero-candidate result', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        Response.json({ choices: [{ message: { content: '{"candidates":[]}' } }] }),
      );
    expect(
      await createUndercoverWordProvider('test-key', fetchImpl).generateBatch('food', []),
    ).toEqual({ candidates: [] });
    expect(fetchImpl).toHaveBeenCalledOnce();
    const request = fetchImpl.mock.calls[0]?.[1];
    expect(request).toMatchObject({ method: 'POST' });
    expect(request?.body).toEqual(expect.stringContaining('json_schema'));
  });
  it('never exposes response bodies or retries rejected requests', async () => {
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('secret provider details', { status: 429 }));
    await expect(
      createUndercoverWordProvider('test-key', fetchImpl).generateBatch('food', []),
    ).rejects.toThrow('HTTP 429');
    expect(fetchImpl).toHaveBeenCalledOnce();
  });
});
