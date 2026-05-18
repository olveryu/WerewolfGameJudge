/**
 * IAuthService - 认证服务接口
 *
 * 定义认证服务的公共 API 契约，覆盖匿名登录、邮箱认证、用户资料管理。
 * 不涉及游戏逻辑或游戏状态存储。
 */

/**
 * API 返回的 user_metadata 完整类型（snake_case wire format）。
 * 与服务端 userProfile.ts 的 UserMetadata 保持一致。
 */
export interface UserMetadata {
  display_name: string | null;
  avatar_url: string | null;
  custom_avatar_url: string | null;
  avatar_frame: string | null;
  seat_flair: string | null;
  name_style: string | null;
  equipped_effect: string | null;
  seat_animation: string | null;
}

/**
 * 抽象用户类型。
 * 仅包含业务代码实际读取的字段。
 */
export interface AuthUser {
  id: string;
  email?: string | null;
  is_anonymous?: boolean;
  has_wechat?: boolean;
  user_metadata?: UserMetadata;
}

/**
 * getCurrentUser() 返回值。
 *
 * 契约：server `/auth/user` 仅在 200 时返回此结构；缺失 user / token 失效 → 401/404，
 * 由 cfFetch 抛出，不会走到这里。所以 `user` 不为 null。
 */
export interface GetCurrentUserResponse {
  data: { user: AuthUser };
}

export interface IAuthService {
  /** 等待初始化完成（session 恢复 / 自动登录） */
  waitForInit(): Promise<void>;

  /** 小程序内是否需要用户手动触发微信登录（仅 miniprogram web-view 内有意义） */
  readonly needsWechatLogin: boolean;

  /**
   * 确保已认证：优先恢复 session，fallback 匿名登录。
   * 网络失败时 throw。
   */
  ensureAuthenticated(): Promise<string>;

  /** 服务是否已配置（环境变量齐全 + client 已初始化） */
  isConfigured(): boolean;

  /** 当前用户 ID（同步读取缓存值） */
  getCurrentUserId(): string | null;

  /**
   * 获取当前用户完整信息。
   * 未登录或 token 失效时返回 null。
   */
  getCurrentUser(): Promise<GetCurrentUserResponse | null>;

  /** 匿名登录，返回 userId */
  signInAnonymously(): Promise<string>;

  /** 邮箱注册（匿名用户升级 or 新建账户） */
  signUpWithEmail(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<{ userId: string; user: AuthUser | null }>;

  /** 邮箱密码登录，返回 userId */
  signInWithEmail(email: string, password: string): Promise<string>;

  /** 更新用户资料（昵称 / 头像 / 头像框 / 座位装饰 / 名字特效 / 开牌特效 / 入座动画） */
  updateProfile(updates: {
    displayName?: string;
    avatarUrl?: string;
    customAvatarUrl?: string;
    avatarFrame?: string;
    seatFlair?: string;
    nameStyle?: string;
    equippedEffect?: string;
    seatAnimation?: string;
  }): Promise<void>;

  /** 登出 */
  signOut(): Promise<void>;

  /** 修改密码（已登录邮箱用户） */
  changePassword(oldPassword: string, newPassword: string): Promise<void>;

  /** 发送密码重置验证码邮件 */
  forgotPassword(email: string): Promise<void>;

  /** 用验证码重置密码，成功后自动登录，返回 userId */
  resetPassword(email: string, code: string, newPassword: string): Promise<string>;

  /** 从本地 session 恢复认证，返回 userId 或 null */
  initAuth(): Promise<string | null>;

  /** 生成随机中文昵称（狼人杀梗前缀 + 角色名），session 内缓存 */
  generateDisplayName(): string;
}
