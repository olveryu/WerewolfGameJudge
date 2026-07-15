/** Zod schemas for /api/feedback endpoints */

import { z } from 'zod';

/** POST /api/feedback — submit new feedback */
export const feedbackSchema = z.strictObject({
  content: z.string().min(1).max(500),
  appVersion: z.string().min(1).max(20),
});

/** POST /api/feedback/:feedbackId/reply — user follow-up reply */
export const feedbackReplySchema = z.strictObject({
  content: z.string().min(1).max(500),
});

/** POST /api/feedback/mark-read — mark replies as read */
export const feedbackMarkReadSchema = z.strictObject({
  feedbackId: z.string().min(1),
});

/** POST /api/feedback/:feedbackId/resolve — resolve or reopen feedback */
export const feedbackResolveSchema = z.strictObject({
  action: z.enum(['resolve', 'reopen']),
});
