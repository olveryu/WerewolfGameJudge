import { describe, expect, it } from 'vitest';

import {
  parseCanonicalIsoTimestampMs,
  requireCanonicalIsoTimestamp,
} from '../canonicalIsoTimestamp';

describe('canonicalIsoTimestamp', () => {
  const canonicalTimestamp = '2026-07-15T12:34:56.789Z';

  it('accepts the exact UTC millisecond representation written by Date.toISOString', () => {
    expect(requireCanonicalIsoTimestamp(canonicalTimestamp, 'timestamp')).toBe(canonicalTimestamp);
    expect(parseCanonicalIsoTimestampMs(canonicalTimestamp, 'timestamp')).toBe(
      Date.UTC(2026, 6, 15, 12, 34, 56, 789),
    );
  });

  it.each([
    '',
    '2026-07-15',
    '2026-07-15T12:34:56Z',
    '2026-07-15T12:34:56.789+00:00',
    '2026-02-30T12:34:56.789Z',
    'not-a-date',
  ])('rejects non-canonical persisted value %s', (value) => {
    expect(() => requireCanonicalIsoTimestamp(value, 'timestamp')).toThrow(
      'timestamp must be a canonical ISO timestamp',
    );
  });
});
