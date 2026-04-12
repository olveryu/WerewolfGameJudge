/**
 * CFAuthService — Cloudflare Workers JWT 认证服务
 *
 * 实现 IAuthService 接口，通过 HTTP 调用 Workers /auth/* 端点。
 * JWT token 持久化在 AsyncStorage，刷新/恢复 session 靠 GET /auth/user。
 * 与 Supabase AuthService 行为语义兼容（匿名 + 邮箱升级 + 资料管理）。
 * 不涉及游戏逻辑或游戏状态存储。
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAllRoleIds, getRoleSpec } from '@werewolf/game-engine/models/roles';

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
          // 已有注册用户 session → 静默绑定微信 openid，不覆盖 session
          authLog.info('Existing registered session, binding WeChat silently');
          try {
            await this.bindWechat(wxCode);
            authLog.info('WeChat bind succeeded');
          } catch (e) {
            authLog.warn('WeChat bind failed (non-fatal)', e);
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
    const token = await AsyncStorage.getItem(TOKEN_STORAGE_KEY);
    if (!token) return null;

    this.#cachedToken = token;
    // Verify token is still valid by calling /auth/user
    try {
      const resp = await cfGet<GetCurrentUserResponse>('/auth/user');
      if (resp.data.user) {
        this.#currentUserId = resp.data.user.id;
        this.#isAnonymous = resp.data.user.is_anonymous ?? false;
        return this.#currentUserId;
      }
    } catch {
      authLog.debug('initAuth: token invalid or expired, clearing');
    }

    await this.#clearToken();
    return null;
  }

  generateDisplayName(uid: string): string {
    const adjectives = [
      '快乐',
      '勇敢',
      '聪明',
      '神秘',
      '可爱',
      '酷炫',
      '狡猾',
      '正义',
      '机智',
      '沉稳',
      '热血',
      '冷静',
      '傲娇',
      '呆萌',
      '腹黑',
      '高冷',
      '温柔',
      '霸气',
      '淡定',
      '暴躁',
      '憨厚',
      '精明',
      '天真',
      '老练',
      '迷糊',
      '清醒',
      '困倦',
      '亢奋',
      '悠闲',
      '忙碌',
      '饥饿',
      '满足',
      '微醺',
      '元气',
      '慵懒',
      '活泼',
      '安静',
      '躁动',
      '专注',
      '发呆',
      '优雅',
      '野性',
      '文艺',
      '朋克',
      '复古',
      '未来',
      '古典',
      '摇滚',
      '甜美',
      '辛辣',
      '清新',
      '浓郁',
      '梦幻',
      '现实',
      '浪漫',
      '理性',
      '超级',
      '无敌',
      '绝世',
      '传说',
      '史诗',
      '究极',
      '至尊',
      '王者',
    ];
    const nouns = getAllRoleIds().map((id) => getRoleSpec(id).displayName);

    const chars = uid.split('');
    const hash1 = chars.reduce((acc, char, i) => acc + (char.codePointAt(0) || 0) * (i + 1), 0);
    const hash3 = chars.reduce((acc, char) => acc ^ (char.codePointAt(0) || 0), 0) * 31;

    const idx1 = Math.abs(hash1) % adjectives.length;
    const idx3 = Math.abs(hash3) % nouns.length;

    return adjectives[idx1] + nouns[idx3];
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
    return this.generateDisplayName(this.#currentUserId || 'anonymous');
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

  async #saveToken(token: string): Promise<void> {
    this.#cachedToken = token;
    await AsyncStorage.setItem(TOKEN_STORAGE_KEY, token);
  }

  async #clearToken(): Promise<void> {
    this.#cachedToken = null;
    await AsyncStorage.removeItem(TOKEN_STORAGE_KEY);
  }
}
