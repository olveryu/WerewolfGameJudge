/**
 * handlers/avatarUpload — R2 头像 Hono routes
 *
 * POST /avatar/upload — 接收 multipart/form-data，
 * 压缩后存入 R2，返回公开可访问的 URL。
 * 上传前自动清理用户旧头像。
 * GET /avatar/:userId/:filename — 从 R2 提供头像文件。
 */

import { Hono } from 'hono';

import type { AppEnv } from '../env';
import { requireAuth } from '../lib/auth';

/**
 * 生成随机 hex 字符串
 */
function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const avatarRoutes = new Hono<AppEnv>();

// POST /avatar/upload — R2 头像上传
avatarRoutes.post('/upload', requireAuth, async (c) => {
  const env = c.env;
  if (!env.AVATARS) return c.json({ error: 'avatar storage not configured' }, 503);

  const userId = c.var.userId;

  // Parse multipart form data
  const formData = await c.req.raw.formData();
  const rawFile = formData.get('file');

  if (!rawFile || typeof rawFile === 'string') {
    return c.json({ error: 'file required' }, 400);
  }

  // Workers runtime: non-string FormData entries are File objects
  const file = rawFile as unknown as File;

  // Validate file type — whitelist safe raster formats; reject SVG (XSS risk)
  const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return c.json({ error: 'invalid file type, only JPEG/PNG/WebP allowed' }, 400);
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return c.json({ error: 'file too large (max 5MB)' }, 400);
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

  // Persist custom_avatar_url to D1 so the client can display it in AvatarPickerScreen
  await env.DB.prepare(
    `UPDATE users SET custom_avatar_url = ?, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(avatarUrlStr, userId)
    .run();

  return c.json({ url: avatarUrlStr }, 200);
});

// GET /avatar/:userId/:filename — 从 R2 提供头像文件
avatarRoutes.get('/:userId/:filename', async (c) => {
  const env = c.env;
  if (!env.AVATARS) return c.json({ error: 'avatar storage not configured' }, 503);

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
