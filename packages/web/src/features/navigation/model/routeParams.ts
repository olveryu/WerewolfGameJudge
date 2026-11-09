/** Strict parsing for untrusted parameters entering client navigation flows. */

function isRouteParams(value: unknown): value is Readonly<Record<string, unknown>> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function parseRouteParams(
  value: unknown,
  routeLabel: string,
): Readonly<Record<string, unknown>> {
  if (!isRouteParams(value)) {
    throw new Error(`[FAIL-FAST] ${routeLabel} route params must be an object`);
  }
  return value;
}

export function assertExactRouteParamKeys(
  params: Readonly<Record<string, unknown>>,
  allowedKeys: readonly string[],
  routeLabel: string,
): void {
  const allowed = new Set(allowedKeys);
  for (const key of Object.keys(params)) {
    if (!allowed.has(key)) {
      throw new Error(`[FAIL-FAST] ${routeLabel} route params contain unknown field: ${key}`);
    }
  }
}
