/**
 * uploadNightReviewImage — temporary Werewolf night-review image upload
 *
 * Uploads a base64 PNG to the Worker /share/image endpoint and returns a public URL.
 * Images are automatically expired and cleaned up via an R2 lifecycle rule (1 day).
 */

import { cfPost } from '@/services/cloudflare/cfFetch';
import { parseUrlResponse } from '@/services/cloudflare/responseCodecs';
import { shareLog } from '@/utils/logger';

/** Uploads a base64 PNG and returns a publicly accessible HTTP URL. */
export async function uploadNightReviewImage(base64: string): Promise<string> {
  shareLog.debug('Uploading share image', { sizeKB: Math.round(base64.length / 1024) });
  const { url } = await cfPost('/share/image', { base64 }, parseUrlResponse);
  return url;
}
