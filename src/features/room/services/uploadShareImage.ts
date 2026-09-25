/** Uploads a temporary PNG for public image previews; R2 expires it after one day. */

import { cfPost } from '@/services/cloudflare/cfFetch';
import { parseUrlResponse } from '@/services/cloudflare/responseCodecs';
import { shareLog } from '@/utils/logger';

/** Returns the public image URL after the authenticated upload succeeds. */
export async function uploadShareImage(base64: string): Promise<string> {
  shareLog.debug('Uploading share image', { sizeKB: Math.round(base64.length / 1024) });
  const { url } = await cfPost('/share/image', { base64 }, parseUrlResponse);
  return url;
}
