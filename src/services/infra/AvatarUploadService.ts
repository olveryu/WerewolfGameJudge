import { supabase, isSupabaseConfigured } from '../../config/supabase';
import { log } from '../../utils/logger';
import { AuthService } from './AuthService';

export class AvatarUploadService {
  private static instance: AvatarUploadService;
  private readonly authService: AuthService;

  private constructor() {
    this.authService = AuthService.getInstance();
  }

  static getInstance(): AvatarUploadService {
    if (!AvatarUploadService.instance) {
      AvatarUploadService.instance = new AvatarUploadService();
    }
    return AvatarUploadService.instance;
  }

  private isConfigured(): boolean {
    return isSupabaseConfigured() && supabase !== null;
  }

  private ensureConfigured(): void {
    if (!this.isConfigured()) {
      throw new Error('Supabase is not configured.');
    }
  }

  async uploadAvatar(fileUri: string): Promise<string> {
    this.ensureConfigured();
    const userId = this.authService.getCurrentUserId();
    if (!userId) throw new Error('Not authenticated');

    // Compress image before upload (512x512 for crisp display on high-DPI screens)
    const compressedBlob = await this.compressImage(fileUri, 512, 0.85);

    const fileExt = 'jpg';
    const fileName = `${userId}/${Date.now()}.${fileExt}`;

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

    return urlData.publicUrl;
  }

  // Compress image to reduce file size while maintaining quality
  private async compressImage(
    fileUri: string,
    maxSize: number = 512,
    quality: number = 0.85,
  ): Promise<Blob> {
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
          reject(new Error('Failed to get canvas context'));
          return;
        }

        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob(
          (blob) => {
            if (blob) {
              log.extend('Avatar').debug(` Compressed image: ${Math.round(blob.size / 1024)}KB`);
              resolve(blob);
            } else {
              reject(new Error('Failed to compress image'));
            }
          },
          'image/jpeg',
          quality,
        );
      };

      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = fileUri;
    });
  }
}

export default AvatarUploadService;
