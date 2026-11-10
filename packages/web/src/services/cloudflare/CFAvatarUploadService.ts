/**
 * CFAvatarUploadService — Cloudflare R2 avatar upload service.
 *
 * Responsibilities:
 * - Implements the IAvatarUploadService interface
 * - Decodes the picked file, scales it to the avatar size and re-encodes it as JPEG
 * - Uploads via multipart/form-data to Workers /avatar/upload
 *
 * Not responsible for:
 * - Game logic or auth logic
 *
 * Boundary constraints:
 * - Implements the app-owned upload contract and returns the persisted public URL
 * - Relies on apiClient for token injection and error interception
 */

import { apiClient } from '@/platform/http/client';
import type { IAvatarUploadService } from '@/services/types/IAvatarUploadService';
import { createLogger } from '@/utils/logger';

import { parseUrlResponse } from './responseCodecs';

const avatarLog = createLogger('CFAvatar');

/** Longest edge of the uploaded avatar, in pixels. */
const AVATAR_MAX_EDGE_PX = 512;
/** JPEG quality of the uploaded avatar. */
const AVATAR_JPEG_QUALITY = 0.85;

/** `width`×`height` scaled down to fit `maxEdge` on its longest side, in whole pixels. */
function fitWithin(
  width: number,
  height: number,
  maxEdge: number,
): { readonly width: number; readonly height: number } {
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** Decodes `file` upright (EXIF orientation applied). */
async function decodeImage(file: File): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (error) {
    throw new Error('图片解码失败，请换一张图片重试', {
      cause: new Error(`Image decode failed (type=${file.type || 'unknown'}, size=${file.size})`, {
        cause: error,
      }),
    });
  }
}

function encodeJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(
          new Error('图片压缩失败，请换一张图片重试', {
            cause: new Error(
              `canvas.toBlob returned null (${canvas.width}x${canvas.height}, image/jpeg q=${quality})`,
            ),
          }),
        );
      },
      'image/jpeg',
      quality,
    );
  });
}

/** Decodes `file`, scales it to the avatar size and re-encodes it as JPEG. */
async function compressAvatar(file: File): Promise<Blob> {
  const bitmap = await decodeImage(file);
  try {
    const { width, height } = fitWithin(bitmap.width, bitmap.height, AVATAR_MAX_EDGE_PX);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('图片处理失败，请换一张图片重试', {
        cause: new Error(`Canvas 2D context unavailable (${width}x${height})`),
      });
    }
    context.drawImage(bitmap, 0, 0, width, height);
    return await encodeJpeg(canvas, AVATAR_JPEG_QUALITY);
  } finally {
    bitmap.close();
  }
}

/** Uploads avatars to Cloudflare R2 through the Worker. */
export class CFAvatarUploadService implements IAvatarUploadService {
  async uploadAvatar(file: File): Promise<string> {
    const avatar = await compressAvatar(file);
    avatarLog.debug('Compressed avatar', { sizeKB: Math.round(avatar.size / 1024) });

    const formData = new FormData();
    formData.append('file', avatar, 'avatar.jpg');

    const data = await apiClient.json({
      method: 'POST',
      path: '/avatar/upload',
      auth: 'required',
      idempotent: true,
      body: formData,
      decode: parseUrlResponse,
    });
    avatarLog.debug('Avatar uploaded', { url: data.url });
    return data.url;
  }
}
