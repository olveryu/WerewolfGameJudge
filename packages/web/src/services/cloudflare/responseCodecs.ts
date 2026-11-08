/** Shared runtime decoders for infrastructure-level HTTP response shapes. */

import { z } from 'zod';

const successResponseSchema = z.strictObject({ success: z.literal(true) });
const urlResponseSchema = z.strictObject({ url: z.url() });

/** Decode the canonical mutation acknowledgement and discard its transport envelope. */
export function parseSuccessResponse(value: unknown): void {
  successResponseSchema.parse(value);
}

/** Decode an endpoint that returns one persisted public URL. */
export function parseUrlResponse(value: unknown): { readonly url: string } {
  return urlResponseSchema.parse(value);
}
