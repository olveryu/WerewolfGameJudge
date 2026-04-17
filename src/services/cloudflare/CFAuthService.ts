/**
 * CFAuthService — Cloudflare Workers JWT 认证服务
 *
 * 实现 IAuthService 接口，通过 HTTP 调用 Workers /auth/* 端点。
 * JWT token 持久化在 MMKV，刷新/恢复 session 靠 GET /auth/user。
 * 与 Supabase AuthService 行为语义兼容（匿名 + 邮箱升级 + 资料管理）。
 * 不涉及游戏逻辑或游戏状态存储。
 */

import { getAllRoleIds, getRoleSpec } from '@werewolf/game-engine/models/roles';

import { storage } from '@/lib/storage';
import type { AuthUser, GetCurrentUserResponse, IAuthService } from '@/services/types/IAuthService';
import { handleError } from '@/utils/errorPipeline';
import { authLog } from '@/utils/logger';
import { consumeWxCode } from '@/utils/miniProgram';
import { withTimeout } from '@/utils/withTimeout';

import { cfGet, cfPost, cfPut, setTokenProvider } from './cfFetch';

const TOKEN_STORAGE_KEY = 'cf_auth_token';

export class CFAuthService implements IAuthService {
  #currentUserId: string | null = null;
  #cachedToken: string | null = null;
  #isAnonymous = false;
  #hasWechat = false;
  #generatedName: string | null = null;
  readonly #initPromise: Promise<void>;

  constructor() {
    // Register token provider so cfFetch auto-injects Bearer header
    setTokenProvider(() => this.#cachedToken);
    this.#initPromise = this.#autoSignIn();
  }

  async #autoSignIn(): Promise<void> {
    try {
      const wxCode = consumeWxCode();
      const existingUserId = await this.initAuth();

      if (wxCode) {
        if (existingUserId && !this.#isAnonymous) {
          if (this.#hasWechat) {
            authLog.debug('WeChat already bound, skipping bind');
          } else {
            authLog.info('Binding WeChat to existing session');
            try {
              await this.bindWechat(wxCode);
              this.#hasWechat = true;
              authLog.info('WeChat bind succeeded');
            } catch (e) {
              authLog.warn('WeChat bind failed (non-fatal)', e);
            }
          }
        } else {
          // 没有 session 或匿名 → 走微信登录
          try {
            await this.signInWithWechat(wxCode);
            authLog.info('WeChat sign-in succeeded:', this.#currentUserId);
          } catch (e) {
            authLog.warn('WeChat sign-in failed, falling through', e);
          }
        }
      } else if (existingUserId) {
        authLog.info('Restored session:', existingUserId);
      }
    } catch (error) {
      handleError(error, { label: 'CFAuth.autoSignIn', logger: authLog, alertTitle: false });
    }
  }

  async waitForInit(): Promise<void> {
    await withTimeout(this.#initPromise, 10000, () => new Error('登录超时，请重试'));
  }

  async ensureAuthenticated(): Promise<string> {
    if (this.#currentUserId) return this.#currentUserId;
    const restored = await this.initAuth();
    if (restored) return restored;
    return this.signInAnonymously();
  }

  isConfigured(): boolean {
    // CF backend is always configured if this service was instantiated
    return true;
  }

  getCurrentUserId(): string | null {
    return this.#currentUserId;
  }

  getCurrentUser(): Promise<GetCurrentUserResponse> | null {
    if (!this.#cachedToken) return null;
    return cfGet<GetCurrentUserResponse>('/auth/user');
  }

  async signInAnonymously(): Promise<string> {
    const data = await cfPost<{
      access_token: string;
      user: { id: string; is_anonymous: boolean };
    }>('/auth/anonymous');

    await this.#saveToken(data.access_token);
    this.#currentUserId = data.user.id;
    return data.user.id;
  }

  async signUpWithEmail(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<{ userId: string; user: AuthUser | null }> {
    const data = await cfPost<{
      access_token: string;
      user: AuthUser;
    }>('/auth/signup', { email, password, displayName });

    await this.#saveToken(data.access_token);
    this.#currentUserId = data.user.id;
    return { userId: data.user.id, user: data.user };
  }

  async signInWithEmail(email: string, password: string): Promise<string> {
    const data = await cfPost<{
      access_token: string;
      user: { id: string };
    }>('/auth/signin', { email, password });

    await this.#saveToken(data.access_token);
    this.#currentUserId = data.user.id;
    return data.user.id;
  }

  async updateProfile(updates: {
    displayName?: string;
    avatarUrl?: string;
    customAvatarUrl?: string;
    avatarFrame?: string;
    seatFlair?: string;
    nameStyle?: string;
  }): Promise<void> {
    await cfPut('/auth/profile', updates);
  }

  async signOut(): Promise<void> {
    await cfPost('/auth/signout');
    await this.#clearToken();
    this.#currentUserId = null;
    this.#isAnonymous = false;
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await cfPut('/auth/password', { oldPassword, newPassword });
  }

  async forgotPassword(email: string): Promise<void> {
    await cfPost('/auth/forgot-password', { email });
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<string> {
    const data = await cfPost<{
      access_token: string;
      user: { id: string };
    }>('/auth/reset-password', { email, code, newPassword });

    await this.#saveToken(data.access_token);
    this.#currentUserId = data.user.id;
    return data.user.id;
  }

  async signInWithWechat(code: string): Promise<string> {
    const data = await cfPost<{
      access_token: string;
      user: { id: string };
    }>('/auth/wechat', { code });

    await this.#saveToken(data.access_token);
    this.#currentUserId = data.user.id;
    return data.user.id;
  }

  async bindWechat(code: string): Promise<void> {
    await cfPost('/auth/bind-wechat', { code });
  }

  async initAuth(): Promise<string | null> {
    const token = storage.getString(TOKEN_STORAGE_KEY) ?? null;
    if (!token) return null;

    this.#cachedToken = token;
    // Verify token is still valid by calling /auth/user
    try {
      const resp = await cfGet<GetCurrentUserResponse>('/auth/user');
      if (resp.data.user) {
        this.#currentUserId = resp.data.user.id;
        this.#isAnonymous = resp.data.user.is_anonymous ?? false;
        this.#hasWechat = resp.data.user.has_wechat ?? false;
        return this.#currentUserId;
      }
    } catch {
      authLog.debug('initAuth: token invalid or expired, clearing');
    }

    await this.#clearToken();
    return null;
  }

  generateDisplayName(): string {
    if (this.#generatedName) return this.#generatedName;

    // 100 个狼人杀梗前缀
    const adjectives = [
      '首刀',
      '自刀',
      '空刀',
      '暗刀',
      '补刀',
      '乱刀',
      '挡刀',
      '背刀',
      '刀法',
      '金水',
      '银水',
      '查杀',
      '反查',
      '发水',
      '深水',
      '对跳',
      '悍跳',
      '裸跳',
      '跳坑',
      '站边',
      '归票',
      '跑票',
      '飞票',
      '铁票',
      '秒投',
      '改票',
      '混票',
      '冲票',
      '拉票',
      '抗推',
      '扛推',
      '放逐',
      '公投',
      '上警',
      '退水',
      '划水',
      '警上',
      '警下',
      '踩人',
      '捞人',
      '倒钩',
      '互踩',
      '互保',
      '自爆',
      '翻盘',
      '翻牌',
      '亮牌',
      '暗牌',
      '明牌',
      '炸牌',
      '摊牌',
      '反水',
      '上岸',
      '抱团',
      '对线',
      '拉扯',
      '破绽',
      '毒奶',
      '甩锅',
      '背锅',
      '挖坑',
      '控场',
      '打底',
      '开车',
      '搭车',
      '带飞',
      '带坑',
      '躺平',
      '躺赢',
      '躺输',
      '苟住',
      '冲锋',
      '收割',
      '逆风',
      '顺风',
      '起飞',
      '血崩',
      '丝血',
      '残局',
      '开局',
      '白板',
      '神位',
      '狼坑',
      '铁狼',
      '独狼',
      '民意',
      '遗言',
      '闭眼',
      '睁眼',
      '天黑',
      '天亮',
      '出局',
      '焦点',
      '口嗨',
      '拍桌',
      '吃药',
      '蹭车',
      '抢水',
      '存活',
      '盘逻辑',
    ];
    const nouns = getAllRoleIds().map((id) => getRoleSpec(id).displayName);

    const arr = new Uint32Array(2);
    crypto.getRandomValues(arr);
    const idx1 = arr[0] % adjectives.length;
    const idx2 = arr[1] % nouns.length;

    this.#generatedName = adjectives[idx1] + '的' + nouns[idx2];
    return this.#generatedName;
  }

  async getCurrentDisplayName(): Promise<string> {
    try {
      const resp = await this.getCurrentUser();
      if (resp) {
        const user = (await resp).data.user;
        const registeredName = user?.user_metadata?.display_name as string | undefined;
        if (registeredName) return registeredName;
      }
    } catch (e) {
      authLog.debug('getCurrentDisplayName failed, falling through to generated name', e);
    }
    return this.generateDisplayName();
  }

  async getCurrentAvatarUrl(): Promise<string | null> {
    try {
      const resp = await this.getCurrentUser();
      if (resp) {
        const user = (await resp).data.user;
        return (user?.user_metadata?.avatar_url as string) || null;
      }
    } catch (e) {
      authLog.debug('getCurrentAvatarUrl failed', e);
    }
    return null;
  }

  async getCurrentAvatarFrame(): Promise<string | null> {
    try {
      const resp = await this.getCurrentUser();
      if (resp) {
        const user = (await resp).data.user;
        return (user?.user_metadata?.avatar_frame as string) || null;
      }
    } catch (e) {
      authLog.debug('getCurrentAvatarFrame failed', e);
    }
    return null;
  }

  async getCurrentSeatFlair(): Promise<string | null> {
    try {
      const resp = await this.getCurrentUser();
      if (resp) {
        const user = (await resp).data.user;
        return (user?.user_metadata?.seat_flair as string) || null;
      }
    } catch (e) {
      authLog.debug('getCurrentSeatFlair failed', e);
    }
    return null;
  }

  async getCurrentNameStyle(): Promise<string | null> {
    try {
      const resp = await this.getCurrentUser();
      if (resp) {
        const user = (await resp).data.user;
        return (user?.user_metadata?.name_style as string) || null;
      }
    } catch (e) {
      authLog.debug('getCurrentNameStyle failed', e);
    }
    return null;
  }

  async #saveToken(token: string): Promise<void> {
    this.#cachedToken = token;
    storage.set(TOKEN_STORAGE_KEY, token);
  }

  async #clearToken(): Promise<void> {
    this.#cachedToken = null;
    storage.remove(TOKEN_STORAGE_KEY);
  }
}
