/** Canonical UTC timestamp validation for persisted Worker data. */

const CANONICAL_ISO_TIMESTAMP_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

function validateCanonicalIsoTimestamp(value: string, label: string): number {
  const epochMs = Date.parse(value);
  if (
    !CANONICAL_ISO_TIMESTAMP_PATTERN.test(value) ||
    !Number.isFinite(epochMs) ||
    new Date(epochMs).toISOString() !== value
  ) {
    throw new Error(`${label} must be a canonical ISO timestamp`);
  }
  return epochMs;
}

/** Validate a canonical UTC timestamp and preserve its string representation. */
export function requireCanonicalIsoTimestamp(value: string, label: string): string {
  validateCanonicalIsoTimestamp(value, label);
  return value;
}

/** Validate a canonical UTC timestamp and return its epoch milliseconds. */
export function parseCanonicalIsoTimestampMs(value: string, label: string): number {
  return validateCanonicalIsoTimestamp(value, label);
}
