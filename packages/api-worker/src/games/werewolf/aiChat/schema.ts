/** Runtime request schema for the Werewolf AI chat endpoint. */

import { z } from 'zod';

export const werewolfAiChatRequestSchema = z.strictObject({
  messages: z
    .array(
      z.strictObject({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
      }),
    )
    .min(1),
  stream: z.boolean().optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.coerce.number().int().positive().optional(),
});
