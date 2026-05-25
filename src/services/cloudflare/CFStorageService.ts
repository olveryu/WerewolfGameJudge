/**
 * CFStorageService — Cloudflare R2 头像上传服务。
 *
 * 职责：
 * - 实现 IStorageService 接口
 * - 通过 multipart/form-data 上传到 Workers /avatar/upload
 * - Web 端本地 DOM Canvas 压缩后再上传
 *
 * 不负责：
 * - 游戏逻辑或认证逻辑
 * - Native 端图片压缩（回退为原图上传）
 *
 * 边界约束：
 * - 与 Supabase AvatarUploadService 行为语义兼容（上传 → 返回公开 URL）
 * - 依赖 cfUpload 处理 token 注入和错误拦截
 */

import type { IStorageService } from '@/services/types/IStorageService';
import { log } from '@/utils/logger';

import { cfUpload } from './cfFetch';

const avatarLog = log.extend('CFAvatar');

/**
 * CFStorageService — 通过 Cloudflare R2 上传头像。
 *
 * 职责：图片压缩、FormData 构建、上传调用。
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
