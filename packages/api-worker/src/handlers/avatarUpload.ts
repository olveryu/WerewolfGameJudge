/**
 * handlers/avatarUpload — R2 avatar Hono routes
 *
 * POST /avatar/upload — accepts multipart/form-data,
 * compresses and stores in R2, returns a publicly accessible URL.
 * Automatically cleans up the user's previous avatar before uploading.
 * GET /avatar/:userId/:filename — serves avatar files from R2.
 *
 * @throws 401 — requireAuth failed (POST only)
 * @throws 400 — missing file field / file exceeds size limit / unsupported format
 * @throws 404 — avatar not found (GET)
 */

import { eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { createDb } from '../db';
import { users } from '../db/schema';
import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';

/**
 * Generate a random hex string
 */
function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** Avatar upload routes. */
export const avatarRoutes = new Hono<AppEnv>();

// POST /avatar/upload — upload avatar to R2
avatarRoutes.post('/upload', requireAuth, async (c) => {
  const env = c.env;
  if (!env.AVATARS) return c.json({ success: false, reason: 'STORAGE_NOT_CONFIGURED' }, 503);

  const userId = c.var.userId;

  // Parse multipart form data
  const formData = await c.req.raw.formData();
  const rawFile = formData.get('file');

  if (!rawFile || typeof rawFile === 'string') {
    return c.json({ success: false, reason: 'FILE_REQUIRED' }, 400);
  }

  // Workers runtime: non-string FormData entries are File objects
  const file = rawFile as unknown as File;

  // Validate file type — whitelist safe raster formats; reject SVG (XSS risk)
  const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return c.json({ success: false, reason: 'INVALID_FILE_TYPE' }, 400);
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return c.json({ success: false, reason: 'FILE_TOO_LARGE' }, 400);
  }

  // List and delete old avatars for this user
  const oldObjects = await env.AVATARS.list({ prefix: `${userId}/` });
  if (oldObjects.objects.length > 0) {
    await Promise.all(oldObjects.objects.map((obj) => env.AVATARS.delete(obj.key)));
  }

  // Upload new avatar
  const suffix = randomHex(4);
  const ext = file.type === 'image/png' ? 'png' : 'jpg';
  const key = `${userId}/${Date.now()}-${suffix}.${ext}`;

  await env.AVATARS.put(key, file.stream(), {
    httpMetadata: {
      contentType: file.type,
    },
  });

  // Build public URL
  const publicUrl = new URL(c.req.url);
  publicUrl.pathname = `/avatar/${key}`;
  publicUrl.search = '';

  const avatarUrlStr = publicUrl.toString();

  // Persist custom_avatar_url AND activate it as the current avatar
  const db = createDb(env.DB);
  await db
    .update(users)
    .set({
      customAvatarUrl: avatarUrlStr,
      avatarUrl: avatarUrlStr,
      updatedAt: sql`datetime('now')`,
    })
    .where(eq(users.id, userId));

  return c.json({ url: avatarUrlStr }, 200);
});

// GET /avatar/:userId/:filename — serve avatar file from R2
avatarRoutes.get('/:userId/:filename', async (c) => {
  const env = c.env;
  if (!env.AVATARS) return c.json({ success: false, reason: 'STORAGE_NOT_CONFIGURED' }, 503);

  const key = `${c.req.param('userId')}/${c.req.param('filename')}`;
  const object = await env.AVATARS.get(key);

  if (!object) {
    return new Response('Not Found', { status: 404 });
  }

  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'image/jpeg',
      'Cache-Control': 'public, max-age=31536000, immutable',
      ETag: object.httpEtag,
    },
  });
});
