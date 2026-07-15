/** Fail-fast runtime decoding primitives shared by game state codecs. */

export type Decoder<T> = (value: unknown, path: string) => T;

export function failDecode(path: string, expectation: string): never {
  throw new Error(`${path} must be ${expectation}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function parseObject(value: unknown, path: string): Record<string, unknown> {
  if (!isRecord(value)) {
    return failDecode(path, 'an object');
  }
  return value;
}

export function finishObject<T extends object>(
  raw: Record<string, unknown>,
  parsed: T,
  path: string,
): T {
  const knownKeys = new Set(Object.keys(parsed));
  for (const key of Object.keys(raw)) {
    if (!knownKeys.has(key)) {
      throw new Error(`${path} contains unknown field: ${key}`);
    }
  }
  return parsed;
}

export function parseString(value: unknown, path: string): string {
  if (typeof value !== 'string') return failDecode(path, 'a string');
  return value;
}

export function parseNonEmptyString(value: unknown, path: string): string {
  const parsed = parseString(value, path);
  if (parsed.length === 0) return failDecode(path, 'a non-empty string');
  return parsed;
}

export function parseBoolean(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') return failDecode(path, 'a boolean');
  return value;
}

export function parseNumber(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return failDecode(path, 'a finite number');
  }
  return value;
}

export function parseInteger(value: unknown, path: string): number {
  const parsed = parseNumber(value, path);
  if (!Number.isSafeInteger(parsed)) return failDecode(path, 'a safe integer');
  return parsed;
}

export function parseSeat(value: unknown, path: string): number {
  const parsed = parseInteger(value, path);
  if (parsed < 0) return failDecode(path, 'a non-negative seat number');
  return parsed;
}

export function parseOptional<T>(value: unknown, path: string, decoder: Decoder<T>): T | undefined {
  return value === undefined ? undefined : decoder(value, path);
}

export function parseNullable<T>(value: unknown, path: string, decoder: Decoder<T>): T | null {
  return value === null ? null : decoder(value, path);
}

export function parseArray<T>(value: unknown, path: string, decoder: Decoder<T>): T[] {
  if (!Array.isArray(value)) return failDecode(path, 'an array');
  return value.map((item, index) => decoder(item, `${path}[${index}]`));
}
