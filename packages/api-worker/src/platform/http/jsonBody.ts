/** Hono JSON request validation backed by a caller-owned Zod schema. */

import type { Context } from 'hono';
import { validator } from 'hono/validator';
import type { z } from 'zod';

/** Return a typed Hono validator that rejects the first schema issue with HTTP 400. */
export function jsonBody<TSchema extends z.ZodType>(schema: TSchema) {
  return validator('json', (value: unknown, context: Context) => {
    const result = schema.safeParse(value);
    if (!result.success) {
      const issue = result.error.issues[0];
      if (issue === undefined) {
        throw new Error('[FAIL-FAST] Zod validation failed without an issue');
      }
      return context.json(
        {
          success: false,
          reason: 'VALIDATION_ERROR',
          detail: `${issue.path.join('.')}: ${issue.message}`,
        },
        400,
      );
    }
    return result.data;
  });
}
