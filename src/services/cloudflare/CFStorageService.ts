/**
 * CFStorageService — Cloudflare R2 avatar upload service.
 *
 * Responsibilities:
 * - Implements the IStorageService interface
 * - Uploads via multipart/form-data to Workers /avatar/upload
 * - On Web, compresses locally with DOM Canvas before upload
 *
 * Not responsible for:
 * - Game logic or auth logic
 * - Image compression on Native (falls back to uploading original)
 *
 * Boundary constraints:
 * - Behaviorally compatible with Supabase AvatarUploadService (upload -> returns public URL)
 * - Relies on cfUpload for token injection and error interception
 */

import type { IStorageService } from '@/services/types/IStorageService';
import { log } from '@/utils/logger';

import { cfUpload } from './cfFetch';

const avatarLog = log.extend('CFAvatar');

/**
 * CFStorageService — uploads avatars via Cloudflare R2.
 *
 * Responsibilities: image compression, FormData construction, upload call.
 */
export class CFStorageService implements IStorageService {
  async uploadAvatar(fileUri: string): Promise<string> {
    // Compress image before upload (Web only — RN fallback to original)
    const blob = await this.#prepareImage(fileUri);

    const formData = new FormData();
    formData.append('file', blob, 'avatar.jpg');

    const data = await cfUpload<{ url: string }>('/avatar/upload', formData);
    avatarLog.debug('Avatar uploaded', { url: data.url });
    return data.url;
  }

  /**
   * Prepare image: compress if DOM APIs available (Web), otherwise fetch original (RN native).
   */
  async #prepareImage(fileUri: string): Promise<Blob> {
    if (this.#isDomCompressionAvailable()) {
      return this.#compressImageWithDom(fileUri, 512, 0.85);
    }
    const response = await fetch(fileUri);
    return response.blob();
  }

  #isDomCompressionAvailable(): boolean {
    return (
      typeof Image !== 'undefined' &&
      typeof document !== 'undefined' &&
      typeof document.createElement === 'function'
    );
  }

  #compressImageWithDom(fileUri: string, maxSize: number, quality: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      img.onload = () => {
        let { width, height } = img;

        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('图片处理失败，请换一张图片重试'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              avatarLog.debug('Compressed image', { sizeKB: Math.round(blob.size / 1024) });
              resolve(blob);
            } else {
              reject(new Error('图片压缩失败，请换一张图片重试'));
            }
          },
          'image/jpeg',
          quality,
        );
      };

      img.onerror = () => reject(new Error('图片加载失败，请换一张图片重试'));
      img.src = fileUri;
    });
  }
}
