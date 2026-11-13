import type { z } from 'zod';

/** Decode an explicit diagnostic contract after Workflows prefixes serialized Error names. */
export function readErrorDiagnostic<Output>(
  error: unknown,
  schema: z.ZodType<Output>,
  errorName: string,
): Output | undefined {
  if (!(error instanceof Error)) return undefined;
  let message = error.message;
  const prefixes = ['Error: ', `${errorName}: `];
  while (true) {
    const prefix = prefixes.find((value) => message.startsWith(value));
    if (prefix === undefined) break;
    message = message.slice(prefix.length);
  }
  if (!message.startsWith('{')) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(message);
  } catch (parseError) {
    if (parseError instanceof SyntaxError) return undefined;
    throw parseError;
  }
  const parsed = schema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
