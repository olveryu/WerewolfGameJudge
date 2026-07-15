/**
 * handlers/shareImage — temporary share image Hono routes (R2)
 *
 * POST /share/image — accepts JSON { base64 },
 * stores under R2 `share/` prefix, returns public URL.
 * Images expire automatically via R2 lifecycle rule (1 day).
 * GET /share/:key — serves image file from R2.
 *
 * @throws 401 — requireAuth failed (POST only)
 * @throws 400 — base64 decode failed or exceeds size limit
 * @throws 404 — key not found on GET
 */

import { randomHex } from '@game-judge/game-engine/platform/identifiers';
import { Hono } from 'hono';

import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';
import { shareImageUploadSchema } from '../schemas/shareImage';
import { jsonBody } from './shared';

const SHARE_IMAGE_SUFFIX_HEX_LENGTH = 12;

/** Share image upload routes. */
export const shareRoutes = new Hono<AppEnv>();

// POST /share/image — upload share image
shareRoutes.post('/image', requireAuth, jsonBody(shareImageUploadSchema), async (c) => {
  const env = c.env;
  if (!env.AVATARS) return c.json({ success: false, reason: 'STORAGE_NOT_CONFIGURED' }, 503);

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
    return c.json({ success: false, reason: 'INVALID_DATA' }, 400);
  }

  // Upload to R2 with share/ prefix
  const key = `share/${Date.now()}-${randomHex(SHARE_IMAGE_SUFFIX_HEX_LENGTH)}.png`;
  await env.AVATARS.put(key, bytes, {
    httpMetadata: { contentType: 'image/png' },
  });

  // Build public URL served by this Worker
  const publicUrl = new URL(c.req.url);
  publicUrl.pathname = `/${key}`;
  publicUrl.search = '';

  return c.json({ url: publicUrl.toString() }, 200);
});

// GET /share/:key+ — serve image from R2
shareRoutes.get('/:key{.+}', async (c) => {
  const env = c.env;
  if (!env.AVATARS) return c.json({ success: false, reason: 'STORAGE_NOT_CONFIGURED' }, 503);

  const key = `share/${c.req.param('key')}`;
  const object = await env.AVATARS.get(key);
  if (!object) return c.json({ success: false, reason: 'NOT_FOUND' }, 404);

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'image/png',
      'Cache-Control': 'public, max-age=86400',
      ETag: object.httpEtag,
    },
  });
});
