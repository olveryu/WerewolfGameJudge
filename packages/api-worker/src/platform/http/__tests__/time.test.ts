import { SELF } from 'cloudflare:test';
import { expect, it } from 'vitest';

it('returns an uncached server clock', async () => {
  const before = Date.now();
  const response = await SELF.fetch('https://test.local/time');
  const after = Date.now();
  expect(response.status).toBe(200);
  expect(response.headers.get('Cache-Control')).toBe('no-store');
  const body = await response.json<{ serverNowMs: number }>();
  expect(body.serverNowMs).toBeGreaterThanOrEqual(before);
  expect(body.serverNowMs).toBeLessThanOrEqual(after);
});
