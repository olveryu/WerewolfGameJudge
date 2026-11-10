/**
 * unreadFeedbackApi — GET /api/feedback/unread-count, the count of unread admin replies.
 *
 * Kept apart from feedbackApi so Home's unread badge does not pull the feedback history
 * schemas into the start-up closure.
 */

import * as z from 'zod/mini';

import { apiClient } from '@/platform/http/client';

const unreadCountResponseSchema = z.strictObject({ count: z.int().check(z.nonnegative()) });

/** Fetches the count of unread admin replies. */
export async function getUnreadFeedbackCount(signal?: AbortSignal): Promise<number> {
  const response = await apiClient.json({
    method: 'GET',
    path: '/api/feedback/unread-count',
    auth: 'required',
    idempotent: true,
    decode: (value) => unreadCountResponseSchema.parse(value),
    signal,
  });
  return response.count;
}
