/**
 * ShareImageService — temporary share image upload (R2)
 *
 * Uploads a base64 PNG to the Worker /share/image endpoint and returns a public URL.
 * Images are automatically expired and cleaned up via an R2 lifecycle rule (1 day).
 */

import { cfPost } from '@/services/cloudflare/cfFetch';
import { shareLog } from '@/utils/logger';

/** Uploads a base64 PNG and returns a publicly accessible HTTP URL. */
export async function uploadShareImage(base64: string): Promise<string> {
  shareLog.debug('Uploading share image', { sizeKB: Math.round(base64.length / 1024) });
  const { url } = await cfPost<{ url: string }>('/share/image', { base64 });
  return url;
}
