/**
 * CFStorageService — Cloudflare R2 头像上传服务
 *
 * 实现 IStorageService 接口，通过 multipart/form-data 上传到 Workers /avatar/upload。
 * 与 Supabase AvatarUploadService 行为语义兼容（上传 → 返回公开 URL）。
 * 压缩在本地端完成（Web DOM Canvas），与 Supabase 版一致。
 * 不涉及游戏逻辑或认证逻辑。
 */

import { API_BASE_URL, API_TIMEOUT_MS } from '@/config/api';
import type { IStorageService } from '@/services/types/IStorageService';
import { log } from '@/utils/logger';
import { withTimeout } from '@/utils/withTimeout';

import { getCurrentToken } from './cfFetch';

const avatarLog = log.extend('CFAvatar');

export class CFStorageService implements IStorageService {
  async uploadAvatar(fileUri: string): Promise<string> {
    // Compress image before upload (Web only — RN fallback to original)
    const blob = await this.#prepareImage(fileUri);

    const formData = new FormData();
    formData.append('file', blob, 'avatar.jpg');

    const token = getCurrentToken();
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const fetchPromise = fetch(`${API_BASE_URL}/avatar/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const res = await withTimeout(fetchPromise, API_TIMEOUT_MS, () => new Error('上传超时'));

    if (!res.ok) {
      const contentType = res.headers.get('content-type') ?? '';
      if (contentType.includes('application/json')) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `上传失败 (${res.status})`);
      }
      throw new Error(`上传失败 (${res.status})`);
    }

    const data = (await res.json()) as { url: string };
    avatarLog.debug('Avatar uploaded:', data.url);
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
              avatarLog.debug(`Compressed image: ${Math.round(blob.size / 1024)}KB`);
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
