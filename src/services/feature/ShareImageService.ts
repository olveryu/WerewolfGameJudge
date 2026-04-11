/**
 * ShareImageService — 临时分享图片上传（R2）
 *
 * 上传 base64 PNG 到 Worker /share/image 端点，返回公开 URL。
 * 图片通过 R2 lifecycle rule 自动过期清理（1 天）。
 */

import { cfPost } from '@/services/cloudflare/cfFetch';

/** 上传 base64 PNG，返回可公开访问的 HTTP URL */
export async function uploadShareImage(base64: string): Promise<string> {
  const { url } = await cfPost<{ url: string }>('/share/image', { base64 });
  return url;
}
