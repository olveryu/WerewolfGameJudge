/**
 * IStorageService - file storage service interface
 *
 * Defines the public API contract for avatar upload.
 * No game logic or auth logic (auth is managed by IAuthService).
 */

export interface IStorageService {
  /**
   * Upload an avatar image and return a publicly accessible URL.
   * Internally handles compression, deduplication, and old-file cleanup.
   * @param fileUri - Local file URI (e.g. `file:///path/to/image.jpg`)
   * @returns Public URL
   */
  uploadAvatar(fileUri: string): Promise<string>;
}
