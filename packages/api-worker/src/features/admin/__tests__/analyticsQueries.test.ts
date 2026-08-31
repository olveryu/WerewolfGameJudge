/** Sampling-aware Admin Analytics Engine query contract tests. */

import { describe, expect, it } from 'vitest';

import { createAIUsageAnalyticsQuery, createLoadTimingAnalyticsQuery } from '../analyticsQueries';

const FROM_DATE = new Date('2026-08-31T00:00:00.000Z');
const TO_DATE = new Date('2026-08-31T01:00:00.000Z');

describe('Admin analytics queries', () => {
  it('weights load counts and timing totals by the sample interval', () => {
    const query = createLoadTimingAnalyticsQuery(FROM_DATE, TO_DATE);

    expect(query).toContain('SUM(_sample_interval) as cnt');
    expect(query).toContain(
      'SUM(_sample_interval * double1) / SUM(_sample_interval) as avg_load_ms',
    );
    expect(query).toContain(
      'SUM(_sample_interval * double7) / SUM(_sample_interval) as avg_ttfb_ms',
    );
    expect(query).not.toMatch(/\bcount\s*\(/i);
    expect(query).not.toMatch(/\bavg\s*\(/i);
  });

  it('weights AI request counts and TTFR totals by the sample interval', () => {
    const query = createAIUsageAnalyticsQuery(FROM_DATE, TO_DATE);

    expect(query).toContain('SUM(_sample_interval) as cnt');
    expect(query).toContain('SUM(_sample_interval * double1) / SUM(_sample_interval) as avgTtfrMs');
    expect(query).not.toMatch(/\bcount\s*\(/i);
    expect(query).not.toMatch(/\bavg\s*\(/i);
  });
});
