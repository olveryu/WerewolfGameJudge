/** Telemetry request schema strictness. */

import { describe, expect, it } from 'vitest';

import { loadTimingSchema } from '../schemas';

const resource = {
  name: 'https://example.com/app.js',
  duration: 10,
  transferSize: 100,
  decodedBodySize: 200,
  dns: 1,
  tcp: 1,
  tls: 1,
  ttfb: 2,
  download: 5,
};

const payload = {
  totalMs: 100,
  htmlTtfb: 20,
  resources: [resource],
  ua: 'test-agent',
};

describe('loadTimingSchema', () => {
  it('rejects unknown root fields', () => {
    expect(loadTimingSchema.safeParse({ ...payload, unexpected: true }).success).toBe(false);
  });

  it('rejects unknown resource fields', () => {
    expect(
      loadTimingSchema.safeParse({
        ...payload,
        resources: [{ ...resource, unexpected: true }],
      }).success,
    ).toBe(false);
  });
});
