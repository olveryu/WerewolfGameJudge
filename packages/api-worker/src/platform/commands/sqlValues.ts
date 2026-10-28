/** Fail-fast decoders for values read back from Durable Object SQLite rows. */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseNonEmptyString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

export function parseNonNegativeInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer`);
  }
  return value;
}

export function parsePositiveInteger(value: unknown, label: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive safe integer`);
  }
  return value;
}

export function parseJsonObject(value: unknown, label: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(parseNonEmptyString(value, label));
  if (!isRecord(parsed)) throw new Error(`${label} must contain an object`);
  return parsed;
}
