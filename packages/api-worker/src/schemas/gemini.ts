/** Zod schemas for /gemini-proxy */

import { z } from 'zod';

export const geminiProxySchema = z.object({
  messages: z.array(z.object({ role: z.string(), content: z.string() })).min(1),
  model: z.string().optional(),
  stream: z.boolean().optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.coerce.number().int().positive().optional(),
});
