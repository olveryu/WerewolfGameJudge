/** Clock sampling must ignore device clock skew and choose the least-delayed server sample. */

import { apiClient } from '@/platform/http/client';

import { synchronizeServerClock } from '../serverClock';

afterEach(() => vi.restoreAllMocks());

it('uses the lowest RTT sample and advances on monotonic time rather than the device date', async () => {
  const monotonic = vi.spyOn(performance, 'now');
  for (const value of [0, 0, 0, 100, 200, 30]) monotonic.mockReturnValueOnce(value);
  vi.spyOn(apiClient, 'json')
    .mockResolvedValueOnce({ serverNowMs: 1_000 })
    .mockResolvedValueOnce({ serverNowMs: 2_000 })
    .mockResolvedValueOnce({ serverNowMs: 10_000 });
  const clock = await synchronizeServerClock(new AbortController().signal);
  monotonic.mockReturnValue(500);
  vi.spyOn(Date, 'now').mockReturnValue(9_000_000);
  expect(clock.nowMs()).toBe(10_485);
  monotonic.mockReturnValue(800);
  expect(clock.nowMs()).toBe(10_785);
});

it('keeps a successful sample when other requests fail and rejects when none are usable', async () => {
  vi.spyOn(performance, 'now').mockReturnValue(0);
  const request = vi.spyOn(apiClient, 'json');
  request
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ serverNowMs: 1_000 })
    .mockRejectedValueOnce(new Error('timeout'));
  const clock = await synchronizeServerClock(new AbortController().signal);
  expect(clock.nowMs()).toBe(1_000);
  request.mockRejectedValue(new Error('offline'));
  await expect(synchronizeServerClock(new AbortController().signal)).rejects.toThrow(
    'Server clock calibration failed',
  );
});
