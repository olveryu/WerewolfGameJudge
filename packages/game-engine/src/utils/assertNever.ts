/**
 * Compile-time exhaustiveness check for discriminated unions.
 *
 * Usage: `default: return assertNever(value);`
 * Throws at runtime if reached (indicates missing case at compile time).
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
