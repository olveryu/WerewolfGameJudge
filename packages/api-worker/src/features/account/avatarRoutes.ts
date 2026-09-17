/**
 * Avatar upload routes owned by the account feature.
 *
 * POST /avatar/upload — accepts multipart/form-data,
 * stores in R2 and conditionally activates a publicly accessible URL.
 * Cleans up the pre-upload object set only after the profile commit succeeds.
 * GET /avatar/:userId/:filename — serves avatar files from R2.
 *
 * @throws 401 — requireAuth failed (POST only)
 * @throws 400 — missing file field / file exceeds size limit / unsupported format
 * @throws 404 — avatar not found (GET)
 * @throws 409 — avatar references changed during upload
 */

import { randomHex } from '@game-judge/game-engine/platform/identifiers';
import { and, eq, sql } from 'drizzle-orm';
import { Hono } from 'hono';

import { createDb } from '../../db';
import type { AppEnv } from '../../env';
import { createLogger } from '../../platform/observability/logger';
import { requireAuth } from '../auth/tokenAuth';
import { users } from './dbSchema';

const AVATAR_SUFFIX_HEX_LENGTH = 8;
const log = createLogger('avatar');

/** Avatar upload routes. */
export const avatarRoutes = new Hono<AppEnv>();

// POST /avatar/upload — upload avatar to R2
avatarRoutes.post('/upload', requireAuth, async (c) => {
  const env = c.env;

  const userId = c.var.userId;

  // Parse multipart form data
  const formData = await c.req.raw.formData();
  const rawFile = formData.get('file');

  if (!rawFile || typeof rawFile === 'string') {
    return c.json({ success: false, reason: 'FILE_REQUIRED' }, 400);
  }

  // Validate file type — whitelist safe raster formats; reject SVG (XSS risk)
  const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!ALLOWED_IMAGE_TYPES.has(rawFile.type)) {
    return c.json({ success: false, reason: 'INVALID_FILE_TYPE' }, 400);
  }

  // Validate file size (max 5MB)
  if (rawFile.size > 5 * 1024 * 1024) {
    return c.json({ success: false, reason: 'FILE_TOO_LARGE' }, 400);
  }

  const db = createDb(env.DB);
  const previousAvatar = await db
    .select({ avatarUrl: users.avatarUrl, customAvatarUrl: users.customAvatarUrl })
    .from(users)
    .where(eq(users.id, userId))
    .get();
  if (previousAvatar === undefined) {
    return c.json({ success: false, reason: 'USER_NOT_FOUND' }, 404);
  }
  const oldObjects: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await env.AVATARS.list({ prefix: `${userId}/`, cursor });
    oldObjects.push(...page.objects.map((object) => object.key));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor !== undefined);

  // Upload new avatar
  const suffix = randomHex(AVATAR_SUFFIX_HEX_LENGTH);
  const ext = rawFile.type === 'image/png' ? 'png' : 'jpg';
  const key = `${userId}/${Date.now()}-${suffix}.${ext}`;

  await env.AVATARS.put(key, rawFile.stream(), {
    httpMetadata: {
      contentType: rawFile.type,
    },
  });

  // Build public URL
  const publicUrl = new URL(c.req.url);
  publicUrl.pathname = `/avatar/${key}`;
  publicUrl.search = '';

  const avatarUrlStr = publicUrl.toString();

  // Persist custom_avatar_url AND activate it as the current avatar
  const updated = await db
    .update(users)
    .set({
      customAvatarUrl: avatarUrlStr,
      avatarUrl: avatarUrlStr,
      updatedAt: sql`datetime('now')`,
    })
    .where(
      and(
        eq(users.id, userId),
        sql`${users.avatarUrl} IS ${previousAvatar.avatarUrl}`,
        sql`${users.customAvatarUrl} IS ${previousAvatar.customAvatarUrl}`,
      ),
    )
    .returning({ id: users.id })
    .get();

  if (updated === undefined) {
    await env.AVATARS.delete(key);
    return c.json({ success: false, reason: 'AVATAR_UPLOAD_CONFLICT' }, 409);
  }

  c.executionCtx.waitUntil(
    Promise.all(oldObjects.map((key) => env.AVATARS.delete(key))).catch((error: unknown) => {
      log.error('avatar cleanup failed; retained objects will be retried on replacement', {
        userId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }),
  );

  return c.json({ url: avatarUrlStr }, 200);
});

// GET /avatar/:userId/:filename — serve avatar file from R2
avatarRoutes.get('/:userId/:filename', async (c) => {
  const env = c.env;

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
