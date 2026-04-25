/**
 * IAuthService - 认证服务接口
 *
 * 定义认证服务的公共 API 契约，覆盖匿名登录、邮箱认证、用户资料管理。
 * 不涉及游戏逻辑或游戏状态存储。
 */

/**
 * 抽象用户类型。
 * 仅包含业务代码实际读取的字段。
 */
export interface AuthUser {
  id: string;
  email?: string | null;
  is_anonymous?: boolean;
  has_wechat?: boolean;
  user_metadata?: Record<string, unknown>;
}

/**
 * getCurrentUser() 返回值。
 */
export interface GetCurrentUserResponse {
  data: { user: AuthUser | null };
}

export interface IAuthService {
  /** 等待初始化完成（session 恢复 / 自动登录） */
  waitForInit(): Promise<void>;

  /** 小程序微信登录是否失败（仅 miniprogram 内有意义） */
  readonly wechatLoginFailed: boolean;

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
   * 未配置时返回 null。
   */
  getCurrentUser(): Promise<GetCurrentUserResponse> | null;

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

  /** 更新用户资料（昵称 / 头像 / 头像框 / 座位装饰 / 名字特效 / 开牌特效） */
  updateProfile(updates: {
    displayName?: string;
    avatarUrl?: string;
    customAvatarUrl?: string;
    avatarFrame?: string;
    seatFlair?: string;
    nameStyle?: string;
    equippedEffect?: string;
  }): Promise<void>;

  /** 登出 */
  signOut(): Promise<void>;

  /** 修改密码（已登录邮箱用户） */
  changePassword(oldPassword: string, newPassword: string): Promise<void>;

  /** 发送密码重置验证码邮件 */
  forgotPassword(email: string): Promise<void>;

  /** 用验证码重置密码，成功后自动登录，返回 userId */
  resetPassword(email: string, code: string, newPassword: string): Promise<string>;

  /** 微信小程序 wx.login code 登录，返回 userId */
  signInWithWechat(code: string): Promise<string>;

  /** 将当前用户绑定微信 openid（已认证用户调用） */
  bindWechat(code: string): Promise<void>;

  /** 从本地 session 恢复认证，返回 userId 或 null */
  initAuth(): Promise<string | null>;

  /** 生成随机中文昵称（狼人杀梗前缀 + 角色名），session 内缓存 */
  generateDisplayName(): string;

  /** 获取当前用户昵称 */
  getCurrentDisplayName(): Promise<string>;

  /** 获取当前用户头像 URL */
  getCurrentAvatarUrl(): Promise<string | null>;

  /** 获取当前用户头像框 ID */
  getCurrentAvatarFrame(): Promise<string | null>;

  /** 获取当前用户座位装饰 ID */
  getCurrentSeatFlair(): Promise<string | null>;

  /** 获取当前用户名称样式 ID */
  getCurrentNameStyle(): Promise<string | null>;
}
