/** Zod schemas for /telemetry/* endpoints */

import { z } from 'zod';

const resourceEntrySchema = z.object({
  name: z.string().max(500),
  duration: z.number().min(0),
  transferSize: z.number().min(0),
  decodedBodySize: z.number().min(0),
  // Network phase breakdown (ms)
  dns: z.number().min(0),
  tcp: z.number().min(0),
  tls: z.number().min(0),
  ttfb: z.number().min(0),
  download: z.number().min(0),
});

export const loadTimingSchema = z.object({
  /** Total boot time from boot:start to app:registered (ms) */
  totalMs: z.number().min(0).max(300_000),
  /** Navigation timing: TTFB for the HTML document (ms) */
  htmlTtfb: z.number().min(0).max(60_000),
  /** Per-resource timing entries */
  resources: z.array(resourceEntrySchema).max(50),
  /** User agent (for ISP/device grouping) */
  ua: z.string().max(500),
});

type _LoadTimingPayload = z.infer<typeof loadTimingSchema>;
