/**
 * handlers/shareImage — 临时分享图片上传 (R2)
 *
 * POST /share/image — 接收 JSON { base64 }，
 * 存入 R2 `share/` prefix，返回公开 URL。
 * 图片通过 R2 lifecycle rule 自动过期清理（1 天）。
 * GET /share/:key — 从 R2 提供图片文件。
 */

import type { Env } from '../env';
import { extractBearerToken, verifyToken } from '../lib/auth';
import { jsonResponse } from '../lib/cors';
import { shareImageUploadSchema } from '../schemas/shareImage';
import { parseBody } from './shared';

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function handleShareImageUpload(request: Request, env: Env): Promise<Response> {
  if (!env.AVATARS) return jsonResponse({ error: 'storage not configured' }, 503, env);

  // Auth check
  const token = extractBearerToken(request);
  if (!token) return jsonResponse({ error: 'unauthorized' }, 401, env);
  const payload = await verifyToken(token, env);
  if (!payload) return jsonResponse({ error: 'unauthorized' }, 401, env);

  const parsed = await parseBody(request, shareImageUploadSchema, env);
  if (parsed instanceof Response) return parsed;
  const { base64 } = parsed;

  // Decode base64 to binary
  let bytes: Uint8Array;
  try {
    const binaryStr = atob(base64);
    bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
  } catch {
    return jsonResponse({ error: 'invalid base64 data' }, 400, env);
  }

  // Upload to R2 with share/ prefix
  const key = `share/${Date.now()}-${randomHex(6)}.png`;
  await env.AVATARS.put(key, bytes, {
    httpMetadata: { contentType: 'image/png' },
  });

  // Build public URL served by this Worker
  const publicUrl = new URL(request.url);
  publicUrl.pathname = `/${key}`;
  publicUrl.search = '';

  return jsonResponse({ url: publicUrl.toString() }, 200, env);
}

export async function handleShareImageServe(
  request: Request,
  env: Env,
  key: string,
): Promise<Response> {
  if (!env.AVATARS) return jsonResponse({ error: 'storage not configured' }, 503, env);

  const object = await env.AVATARS.get(key);
  if (!object) return jsonResponse({ error: 'not found' }, 404, env);

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'image/png',
      'Cache-Control': 'public, max-age=86400',
      ETag: object.httpEtag,
    },
  });
}
