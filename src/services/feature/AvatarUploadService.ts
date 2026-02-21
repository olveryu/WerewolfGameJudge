import { randomHex } from '@werewolf/game-engine/utils/id';

import type { AuthService } from '@/services/infra/AuthService';
import { isSupabaseConfigured, supabase } from '@/services/infra/supabaseClient';
import { log } from '@/utils/logger';

const avatarLog = log.extend('Avatar');

/**
 * AvatarUploadService - 头像上传服务
 *
 * 将用户头像上传到 Supabase Storage 并返回公开可访问的头像 URL。
 * 涵盖 Supabase Storage API 调用和文件格式转换。
 * 不涉及游戏逻辑或游戏状态存储。
 */
export class AvatarUploadService {
  private readonly authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  private isConfigured(): boolean {
    return isSupabaseConfigured() && supabase !== null;
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error('服务未配置，请检查网络连接');
    }
  }

  async uploadAvatar(fileUri: string): Promise<string> {
    this.ensureConfigured();
    const userId = this.authService.getCurrentUserId();
    if (!userId) throw new Error('请先登录后再上传头像');

    // List existing avatars before upload (for cleanup after success)
    const oldFiles = await this.listUserAvatars(userId);

    // Compress image before upload (512x512 for crisp display on high-DPI screens)
    const compressedBlob = await this.compressImage(fileUri, 512, 0.85);

    const fileExt = 'jpg';
    const randomSuffix = randomHex(8); // 8 hex chars = 4 bytes = ~4 billion combinations
    const fileName = `${userId}/${Date.now()}-${randomSuffix}.${fileExt}`;

    const { data, error } = await supabase!.storage
      .from('avatars')
      .upload(fileName, compressedBlob, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (error) throw error;

    // Get public URL
    const { data: urlData } = supabase!.storage.from('avatars').getPublicUrl(data.path);

    // Update user profile with avatar URL
    await this.authService.updateProfile({ avatarUrl: urlData.publicUrl });

    avatarLog.debug('Uploaded avatar', { fileName, size: compressedBlob.size });

    // Clean up old avatars (best-effort, failure doesn't affect new upload)
    await this.deleteOldAvatars(userId, oldFiles, fileName);

    return urlData.publicUrl;
  }

  /**
   * List all avatar files for a given user.
   */
  private async listUserAvatars(userId: string): Promise<string[]> {
    const { data, error } = await supabase!.storage.from('avatars').list(userId);
    if (error) {
      avatarLog.warn('Failed to list old avatars', { error: error.message });
      return [];
    }
    return (data ?? []).map((f) => `${userId}/${f.name}`);
  }

  /**
   * Delete old avatar files after a successful upload.
   * Best-effort: logs warning on failure but never throws.
   */
  private async deleteOldAvatars(
    userId: string,
    oldFiles: string[],
    newFileName: string,
  ): Promise<void> {
    const toDelete = oldFiles.filter((f) => f !== newFileName);
    if (toDelete.length === 0) return;

    const { error } = await supabase!.storage.from('avatars').remove(toDelete);
    if (error) {
      avatarLog.warn('Failed to delete old avatars', {
        error: error.message,
        count: toDelete.length,
      });
    } else {
      avatarLog.debug('Deleted old avatars', { count: toDelete.length });
    }
  }

  /**
   * Check if DOM image compression APIs are available.
   * Returns false in React Native native environment.
   */
  private isDomCompressionAvailable(): boolean {
    return (
      typeof Image !== 'undefined' &&
      typeof document !== 'undefined' &&
      typeof document.createElement === 'function'
    );
  }

  /**
   * Compress image to reduce file size while maintaining quality.
   * Falls back to original image if DOM APIs are not available (RN native).
   */
  private async compressImage(
    fileUri: string,
    maxSize: number = 512,
    quality: number = 0.85,
  ): Promise<Blob> {
    // Fallback: skip compression if DOM APIs not available (RN native)
    if (!this.isDomCompressionAvailable()) {
      avatarLog.debug('DOM compression APIs not available, fetching original image');
      const response = await fetch(fileUri);
      return response.blob();
    }

    return this.compressImageWithDom(fileUri, maxSize, quality);
  }

  /**
   * DOM-based image compression (browser/web only).
   */
  private compressImageWithDom(fileUri: string, maxSize: number, quality: number): Promise<Blob> {
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
