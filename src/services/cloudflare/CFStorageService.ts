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
 * Extract the URI scheme (e.g. "blob", "data", "https") for diagnostics.
 * Avoids leaking the full URI into Sentry, which for data: URLs carries the
 * entire base64 payload.
 */
function describeUriScheme(uri: string): string {
  const idx = uri.indexOf(':');
  return idx > 0 ? uri.slice(0, idx) : 'unknown';
}

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

  /**
   * Convert a blob: URL to a data: URL via fetch + FileReader.
   *
   * WeChat WebView's renderer sandbox blocks blob: URLs when set as img.src, but
   * fetch() can still read blob: URLs from memory. Converting to a data URL first
   * lets the <img> element load the image without triggering onerror.
   */
  async #blobUrlToDataUrl(blobUrl: string): Promise<string> {
    const response = await fetch(blobUrl);
    const blob = await response.blob();
    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      // FileReader.error is a DOMException carrying the real failure reason — pass it as cause.
      reader.onerror = () =>
        reject(
          new Error('图片读取失败，请换一张图片重试', {
            cause:
              reader.error ??
              new Error(`FileReader failed (type=${blob.type || 'unknown'}, size=${blob.size})`),
          }),
        );
      reader.readAsDataURL(blob);
    });
  }

  async #compressImageWithDom(fileUri: string, maxSize: number, quality: number): Promise<Blob> {
    // WeChat WebView blocks blob: URLs when used as img.src — convert to data URL first.
    const imgSrc = fileUri.startsWith('blob:') ? await this.#blobUrlToDataUrl(fileUri) : fileUri;

    return new Promise((resolve, reject) => {
      const img = new Image();

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
          reject(
            new Error('图片处理失败，请换一张图片重试', {
              cause: new Error(`Canvas 2D context unavailable (${width}x${height})`),
            }),
          );
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              avatarLog.debug('Compressed image', { sizeKB: Math.round(blob.size / 1024) });
              resolve(blob);
            } else {
              reject(
                new Error('图片压缩失败，请换一张图片重试', {
                  cause: new Error(
                    `canvas.toBlob returned null (${width}x${height}, image/jpeg q=${quality})`,
                  ),
                }),
              );
            }
          },
          'image/jpeg',
          quality,
        );
      };

      // The <img> error event is a bare Event with no detail — synthesize scheme context
      // (data:/blob:/https:) so Sentry can tell the WeChat blob→dataURL path from direct loads.
      img.onerror = () =>
        reject(
          new Error('图片解码失败，请换一张图片重试', {
            cause: new Error(
              `Image decode failed (src=${describeUriScheme(imgSrc)}, origin=${describeUriScheme(fileUri)})`,
            ),
          }),
        );
      img.src = imgSrc;
    });
  }
}
