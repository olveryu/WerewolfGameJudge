/** Runtime request schema for the Werewolf AI chat endpoint. */

import { z } from 'zod';

export const werewolfAiChatRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string(),
      }),
    )
    .min(1),
  stream: z.boolean().optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.coerce.number().int().positive().optional(),
});
