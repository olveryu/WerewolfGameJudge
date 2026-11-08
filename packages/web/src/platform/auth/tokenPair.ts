/** Exact decoder for the Worker's rotated token pair. */

import { z } from 'zod';

export const tokenPairSchema = {
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
};

const tokenPairResponseSchema = z.strictObject(tokenPairSchema);

export type TokenPairResponse = z.infer<typeof tokenPairResponseSchema>;

export function parseTokenPairResponse(value: unknown): TokenPairResponse {
  return tokenPairResponseSchema.parse(value);
}
