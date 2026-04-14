/**
 * handlers/shareImage — 临时分享图片 Hono routes (R2)
 *
 * POST /share/image — 接收 JSON { base64 }，
 * 存入 R2 `share/` prefix，返回公开 URL。
 * 图片通过 R2 lifecycle rule 自动过期清理（1 天）。
 * GET /share/:key — 从 R2 提供图片文件。
 */

import { Hono } from 'hono';

import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';
import { shareImageUploadSchema } from '../schemas/shareImage';
import { jsonBody } from './shared';

function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const shareRoutes = new Hono<AppEnv>();

// POST /share/image — 上传分享图片
shareRoutes.post('/image', requireAuth, jsonBody(shareImageUploadSchema), async (c) => {
  const env = c.env;
  if (!env.AVATARS) return c.json({ error: 'storage not configured' }, 503);

  const { base64 } = c.req.valid('json');

  // Decode base64 to binary
  let bytes: Uint8Array;
  try {
    const binaryStr = atob(base64);
    bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
  } catch {
    return c.json({ error: 'invalid base64 data' }, 400);
  }

  // Upload to R2 with share/ prefix
  const key = `share/${Date.now()}-${randomHex(6)}.png`;
  await env.AVATARS.put(key, bytes, {
    httpMetadata: { contentType: 'image/png' },
  });

  // Build public URL served by this Worker
  const publicUrl = new URL(c.req.url);
  publicUrl.pathname = `/${key}`;
  publicUrl.search = '';

  return c.json({ url: publicUrl.toString() }, 200);
});

// GET /share/:key+ — 从 R2 提供图片
shareRoutes.get('/:key{.+}', async (c) => {
  const env = c.env;
  if (!env.AVATARS) return c.json({ error: 'storage not configured' }, 503);

  const key = `share/${c.req.param('key')}`;
  const object = await env.AVATARS.get(key);
  if (!object) return c.json({ error: 'not found' }, 404);

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'image/png',
      'Cache-Control': 'public, max-age=86400',
      ETag: object.httpEtag,
    },
  });
});
