/** Zod schemas for /api/feedback endpoints */

import { z } from 'zod';

/** POST /api/feedback — submit new feedback */
export const feedbackSchema = z.object({
  content: z.string().min(1).max(500),
  appVersion: z.string().min(1).max(20),
});

/** POST /api/feedback/:feedbackId/reply — user follow-up reply */
export const feedbackReplySchema = z.object({
  content: z.string().min(1).max(500),
});

/** POST /api/feedback/mark-read — mark replies as read */
export const feedbackMarkReadSchema = z.object({
  feedbackId: z.string().min(1),
});
