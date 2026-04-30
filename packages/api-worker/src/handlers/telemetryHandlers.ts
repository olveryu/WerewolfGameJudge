/**
 * telemetryHandlers — Load timing telemetry endpoint
 *
 * Receives per-resource timing data from web clients and writes to
 * Analytics Engine for query via CF SQL API. No auth required — fire-and-forget.
 */

import { Hono } from 'hono';

import type { AppEnv } from '../env';
import { loadTimingSchema } from '../schemas/telemetry';

export const telemetryRoutes = new Hono<AppEnv>();

telemetryRoutes.post('/load-timing', async (c) => {
  // sendBeacon sends text/plain to avoid CORS preflight — parse manually
  const raw = await c.req.text();
  const parsed = loadTimingSchema.safeParse(JSON.parse(raw));
  if (!parsed.success) {
    return c.json({ success: false, reason: 'VALIDATION_ERROR' }, 400);
  }
  const payload = parsed.data;
  const cf = (c.req.raw as Request & { cf?: IncomingRequestCfProperties }).cf;

  // Write one data point per resource entry — each becomes a queryable row
  for (const res of payload.resources) {
    // Extract short filename from URL for readable queries
    let shortName: string;
    try {
      const pathname = new URL(res.name).pathname;
      shortName = pathname.split('/').pop() || pathname;
    } catch {
      shortName = res.name.split('/').pop() || res.name;
    }

    c.env.LOAD_TIMING.writeDataPoint({
      indexes: [shortName],
      blobs: [
        res.name, // blob1: full URL
        payload.ua, // blob2: user agent
        cf?.country ?? 'unknown', // blob3: country
        cf?.colo ?? 'unknown', // blob4: CF colo (edge location)
        cf?.asOrganization ?? '', // blob5: ISP/ASN org name
      ],
      doubles: [
        res.duration, // double1: total duration ms
        res.transferSize, // double2: transfer size bytes
        res.decodedBodySize, // double3: decoded body size
        res.dns, // double4: DNS lookup ms
        res.tcp, // double5: TCP connect ms
        res.tls, // double6: TLS handshake ms
        res.ttfb, // double7: time to first byte ms
        res.download, // double8: download time ms
        payload.totalMs, // double9: total boot time ms
        payload.htmlTtfb, // double10: HTML document TTFB ms
      ],
    });
  }

  return c.json({ success: true }, 200);
});
