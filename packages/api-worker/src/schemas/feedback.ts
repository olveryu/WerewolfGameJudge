/** Zod schema for POST /api/feedback */

import { z } from 'zod';

export const feedbackSchema = z.object({
  content: z.string().min(1).max(500),
  appVersion: z.string().min(1).max(20),
});
