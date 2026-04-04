/**
 * IStorageService - 文件存储服务接口
 *
 * 定义头像上传的公共 API 契约。
 * Supabase Storage 和 Cloudflare R2 实现均需满足此接口。
 * 不涉及游戏逻辑或认证逻辑（认证由 IAuthService 管理）。
 */

export interface IStorageService {
  /**
   * 上传头像图片，返回公开可访问的 URL。
   * 内部处理压缩、去重、旧文件清理。
   * @param fileUri - 本地文件 URI（如 `file:///path/to/image.jpg`）
   * @returns 公开 URL
   */
  uploadAvatar(fileUri: string): Promise<string>;
}
