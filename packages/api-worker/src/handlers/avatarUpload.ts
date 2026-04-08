/**
 * handlers/avatarUpload — R2 头像上传 API
 *
 * POST /avatar/upload — 接收 multipart/form-data，
 * 压缩后存入 R2，返回公开可访问的 URL。
 * 上传前自动清理用户旧头像。
 */

import type { Env } from '../env';
import { extractBearerToken, verifyToken } from '../lib/auth';
import { corsHeaders, jsonResponse } from '../lib/cors';

/**
 * 生成随机 hex 字符串
 */
function randomHex(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return [...buf].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export async function handleAvatarUpload(request: Request, env: Env): Promise<Response> {
  if (!env.AVATARS) return jsonResponse({ error: 'avatar storage not configured' }, 503, env);

  // Auth check
  const token = extractBearerToken(request);
  if (!token) return jsonResponse({ error: 'unauthorized' }, 401, env);
  const payload = await verifyToken(token, env);
  if (!payload) return jsonResponse({ error: 'unauthorized' }, 401, env);

  const userId = payload.sub;

  // Parse multipart form data
  const formData = await request.formData();
  const rawFile = formData.get('file');

  if (!rawFile || typeof rawFile === 'string') {
    return jsonResponse({ error: 'file required' }, 400, env);
  }

  // Workers runtime: non-string FormData entries are File objects
  const file = rawFile as unknown as File;

  // Validate file type — whitelist safe raster formats; reject SVG (XSS risk)
  const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    return jsonResponse({ error: 'invalid file type, only JPEG/PNG/WebP allowed' }, 400, env);
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return jsonResponse({ error: 'file too large (max 5MB)' }, 400, env);
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
  // R2 public access: https://<custom-domain>/<key> or via Worker serving
  // For now, serve via the same Worker at /avatar/<key>
  const publicUrl = new URL(request.url);
  publicUrl.pathname = `/avatar/${key}`;
  publicUrl.search = '';

  return jsonResponse({ url: publicUrl.toString() }, 200, env);
}

/**
 * GET /avatar/:userId/:filename — 从 R2 提供头像文件
 */
export async function handleAvatarServe(
  request: Request,
  env: Env,
  key: string,
): Promise<Response> {
  if (!env.AVATARS) return jsonResponse({ error: 'avatar storage not configured' }, 503, env);

  const object = await env.AVATARS.get(key);

  if (!object) {
    return new Response('Not Found', { status: 404 });
  }

  const headers = new Headers(corsHeaders(env));
  headers.set('Content-Type', object.httpMetadata?.contentType ?? 'image/jpeg');
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('ETag', object.httpEtag);

  return new Response(object.body, { headers });
}
