/** Estimate server time on a monotonic clock without changing the device's wall clock. */

import { z } from 'zod';

import { apiClient } from '@/platform/http/client';

export interface ServerClock {
  readonly nowMs: () => number;
}

const clockResponseSchema = z.strictObject({ serverNowMs: z.int().nonnegative() });

/** Use the lowest-latency of three samples; callers explicitly handle unavailable calibration. */
export async function synchronizeServerClock(signal: AbortSignal): Promise<ServerClock> {
  const samples = await Promise.allSettled(
    Array.from({ length: 3 }, async () => {
      const startedAt = performance.now();
      const { serverNowMs } = await apiClient.json({
        method: 'GET',
        path: '/time',
        auth: 'none',
        idempotent: true,
        timeoutMs: 3_000,
        signal,
        decode: (value) => clockResponseSchema.parse(value),
      });
      const finishedAt = performance.now();
      return {
        roundTripMs: finishedAt - startedAt,
        midpoint: (startedAt + finishedAt) / 2,
        serverNowMs,
      };
    }),
  );
  signal.throwIfAborted();
  const successful = samples
    .filter((sample) => sample.status === 'fulfilled')
    .map((sample) => sample.value)
    .sort((left, right) => left.roundTripMs - right.roundTripMs);
  const best = successful[0];
  if (best === undefined) {
    throw new AggregateError(
      samples
        .filter((sample) => sample.status === 'rejected')
        .map((sample) => {
          const reason: unknown = sample.reason;
          return reason;
        }),
      'Server clock calibration failed',
    );
  }
  return { nowMs: () => best.serverNowMs + performance.now() - best.midpoint };
}
