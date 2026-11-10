/** Exact decoder for the Worker's rotated token pair. */

import * as z from 'zod/mini';

export const tokenPairSchema = {
  access_token: z.string().check(z.minLength(1)),
  refresh_token: z.string().check(z.minLength(1)),
};

const tokenPairResponseSchema = z.strictObject(tokenPairSchema);

export type TokenPairResponse = z.infer<typeof tokenPairResponseSchema>;

export function parseTokenPairResponse(value: unknown): TokenPairResponse {
  return tokenPairResponseSchema.parse(value);
}
