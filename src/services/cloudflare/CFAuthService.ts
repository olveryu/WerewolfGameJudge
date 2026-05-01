/**
 * CFAuthService — Cloudflare Workers JWT 认证服务
 *
 * 实现 IAuthService 接口，通过 HTTP 调用 Workers /auth/* 端点。
 * 管理 access token（短期 JWT, 1h）+ refresh token（90d, rotation）。
 * Token 持久化在 MMKV，401 自动 refresh 由 cfFetch 拦截器驱动。
 */

import * as Sentry from '@sentry/react-native';
import { getAllRoleIds, getRoleSpec } from '@werewolf/game-engine/models/roles';

import { storage } from '@/lib/storage';
import type { AuthUser, GetCurrentUserResponse, IAuthService } from '@/services/types/IAuthService';
import { handleError } from '@/utils/errorPipeline';
import { authLog } from '@/utils/logger';
import { clearWxCode, isMiniProgram, readWxCode } from '@/utils/miniProgram';
import { withTimeout } from '@/utils/withTimeout';

import {
  cfGet,
  cfPost,
  cfPut,
  setOnAuthExpired,
  setRefreshHandler,
  setTokenProvider,
} from './cfFetch';

const ACCESS_TOKEN_KEY = 'cf_auth_token';
const REFRESH_TOKEN_KEY = 'cf_refresh_token';

export class CFAuthService implements IAuthService {
  #currentUserId: string | null = null;
  #cachedAccessToken: string | null = null;
  #cachedRefreshToken: string | null = null;
  #isAnonymous = false;
  #hasWechat = false;
  #generatedName: string | null = null;
  #wechatLoginFailed = false;
  readonly #initPromise: Promise<void>;

  get wechatLoginFailed(): boolean {
    return this.#wechatLoginFailed;
  }

  constructor() {
    // Register token provider so cfFetch auto-injects Bearer header
    setTokenProvider(() => this.#cachedAccessToken);
    // Register refresh handler for 401 interception
    setRefreshHandler(() => this.#refreshTokens());
    // Register auth expired callback
    setOnAuthExpired(() => this.#handleAuthExpired());

    this.#initPromise = this.#autoSignIn();
  }

  async #autoSignIn(): Promise<void> {
    try {
      const wxCode = readWxCode();
      const existingUserId = await this.initAuth();

      if (wxCode) {
        if (existingUserId && !this.#isAnonymous) {
          if (this.#hasWechat) {
            clearWxCode();
            authLog.debug('WeChat already bound, skipping bind');
          } else {
            authLog.info('Binding WeChat to existing session');
            try {
              await this.bindWechat(wxCode);
              this.#hasWechat = true;
              clearWxCode();
              authLog.info('WeChat bind succeeded');
            } catch (e) {
              authLog.warn('WeChat bind failed (non-fatal)', e);
            }
          }
        } else {
          try {
            await this.signInWithWechat(wxCode);
            clearWxCode();
            authLog.info('WeChat sign-in succeeded', { userId: this.#currentUserId });
          } catch (e) {
            clearWxCode();
            authLog.warn('WeChat sign-in failed', e);
            if (!isMiniProgram()) {
              authLog.warn('WeChat sign-in failed outside miniprogram, falling back to anonymous');
              await this.signInAnonymously();
            } else {
              this.#wechatLoginFailed = true;
            }
          }
        }
      } else if (existingUserId) {
        authLog.info('Restored session', { userId: existingUserId });
      }
    } catch (error) {
      handleError(error, { label: 'CFAuth.autoSignIn', logger: authLog, alertTitle: false });
    }
  }

  async waitForInit(): Promise<void> {
    await withTimeout(this.#initPromise, 25000, () => new Error('登录超时，请重试'));
  }

  async ensureAuthenticated(): Promise<string> {
    if (this.#currentUserId) return this.#currentUserId;
    const restored = await this.initAuth();
    if (restored) return restored;
    return this.signInAnonymously();
  }

  isConfigured(): boolean {
    return true;
  }

  getCurrentUserId(): string | null {
    return this.#currentUserId;
  }

  async getCurrentUser(): Promise<GetCurrentUserResponse | null> {
    if (!this.#cachedAccessToken) return null;
    return cfGet<GetCurrentUserResponse>('/auth/user');
  }

  async signInAnonymously(): Promise<string> {
    const data = await cfPost<{
      access_token: string;
      refresh_token: string;
      user: { id: string; is_anonymous: boolean };
    }>('/auth/anonymous', undefined, { skipAuthIntercept: true });

    this.#saveTokens(data.access_token, data.refresh_token);
    this.#currentUserId = data.user.id;
    this.#isAnonymous = true;
    Sentry.setUser({ id: data.user.id });
    return data.user.id;
  }

  async signUpWithEmail(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<{ userId: string; user: AuthUser | null }> {
    const data = await cfPost<{
      access_token: string;
      refresh_token: string;
      user: AuthUser;
    }>('/auth/signup', { email, password, displayName });

    this.#saveTokens(data.access_token, data.refresh_token);
    this.#currentUserId = data.user.id;
    this.#isAnonymous = false;
    Sentry.setUser({ id: data.user.id });
    return { userId: data.user.id, user: data.user };
  }

  async signInWithEmail(email: string, password: string): Promise<string> {
    const data = await cfPost<{
      access_token: string;
      refresh_token: string;
      user: { id: string };
    }>('/auth/signin', { email, password }, { skipAuthIntercept: true });

    this.#saveTokens(data.access_token, data.refresh_token);
    this.#currentUserId = data.user.id;
    this.#isAnonymous = false;
    Sentry.setUser({ id: data.user.id });
    return data.user.id;
  }

  async updateProfile(updates: {
    displayName?: string;
    avatarUrl?: string;
    customAvatarUrl?: string;
    avatarFrame?: string;
    seatFlair?: string;
    nameStyle?: string;
    equippedEffect?: string;
    seatAnimation?: string;
  }): Promise<void> {
    await cfPut('/auth/profile', updates);
  }

  async signOut(): Promise<void> {
    try {
      await cfPost('/auth/signout');
    } catch {
      // Best effort — server may reject if token already expired
    }
    this.#clearTokens();
    this.#currentUserId = null;
    this.#isAnonymous = false;
    Sentry.setUser(null);
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await cfPut('/auth/password', { oldPassword, newPassword });
    // Server bumps tokenVersion — current tokens still work until expiry
    // but refresh will get new version. Force re-login for security:
    this.#clearTokens();
  }

  async forgotPassword(email: string): Promise<void> {
    await cfPost('/auth/forgot-password', { email }, { skipAuthIntercept: true });
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<string> {
    const data = await cfPost<{
      access_token: string;
      refresh_token: string;
      user: { id: string };
    }>('/auth/reset-password', { email, code, newPassword }, { skipAuthIntercept: true });

    this.#saveTokens(data.access_token, data.refresh_token);
    this.#currentUserId = data.user.id;
    this.#isAnonymous = false;
    Sentry.setUser({ id: data.user.id });
    return data.user.id;
  }

  async signInWithWechat(code: string): Promise<string> {
    const WECHAT_AUTH_TIMEOUT_MS = 20000;
    const data = await cfPost<{
      access_token: string;
      refresh_token: string;
      user: { id: string };
    }>('/auth/wechat', { code }, { timeoutMs: WECHAT_AUTH_TIMEOUT_MS, skipAuthIntercept: true });

    this.#saveTokens(data.access_token, data.refresh_token);
    this.#currentUserId = data.user.id;
    this.#isAnonymous = false;
    Sentry.setUser({ id: data.user.id });
    return data.user.id;
  }

  async bindWechat(code: string): Promise<void> {
    await cfPost('/auth/bind-wechat', { code });
  }

  /**
   * Restore session from MMKV.
   * - If access token works: restore immediately.
   * - If access token fails but refresh succeeds: restore with refreshed token.
   * - If network error: keep tokens (don't clear), decode userId from access token locally.
   * - If both tokens invalid (401/403): clear and return null.
   */
  async initAuth(): Promise<string | null> {
    const accessToken = storage.getString(ACCESS_TOKEN_KEY) ?? null;
    const refreshToken = storage.getString(REFRESH_TOKEN_KEY) ?? null;
    if (!accessToken) return null;

    this.#cachedAccessToken = accessToken;
    this.#cachedRefreshToken = refreshToken;

    try {
      const resp = await cfGet<GetCurrentUserResponse>('/auth/user', { skipAuthIntercept: true });
      this.#currentUserId = resp.data.user!.id;
      this.#isAnonymous = resp.data.user!.is_anonymous ?? false;
      this.#hasWechat = resp.data.user!.has_wechat ?? false;
      Sentry.setUser({ id: resp.data.user!.id });
      return this.#currentUserId;
    } catch (error: unknown) {
      const status = (error as { status?: number }).status;

      if (status === 401 || status === 404) {
        // Access token expired/revoked — try refresh
        if (refreshToken) {
          const refreshed = await this.#refreshTokens();
          if (refreshed) {
            // Retry /auth/user with new token
            try {
              const resp = await cfGet<GetCurrentUserResponse>('/auth/user', {
                skipAuthIntercept: true,
              });
              this.#currentUserId = resp.data.user!.id;
              this.#isAnonymous = resp.data.user!.is_anonymous ?? false;
              this.#hasWechat = resp.data.user!.has_wechat ?? false;
              Sentry.setUser({ id: resp.data.user!.id });
              return this.#currentUserId;
            } catch {
              // Refreshed but still fails — clear everything
              this.#clearTokens();
              return null;
            }
          }
        }
        // No refresh token or refresh failed
        this.#clearTokens();
        return null;
      }

      // Network error — don't clear tokens, try to decode userId locally
      authLog.warn('initAuth: network error, keeping tokens for offline use', { status });
      const userId = this.#decodeUserIdFromJwt(accessToken);
      if (userId) {
        this.#currentUserId = userId;
        Sentry.setUser({ id: userId });
        return userId;
      }
      return null;
    }
  }

  generateDisplayName(): string {
    if (this.#generatedName) return this.#generatedName;

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

  // ── Private: Token management ─────────────────────────────────────────────

  #saveTokens(accessToken: string, refreshToken: string): void {
    this.#cachedAccessToken = accessToken;
    this.#cachedRefreshToken = refreshToken;
    storage.set(ACCESS_TOKEN_KEY, accessToken);
    storage.set(REFRESH_TOKEN_KEY, refreshToken);
  }

  #clearTokens(): void {
    this.#cachedAccessToken = null;
    this.#cachedRefreshToken = null;
    storage.remove(ACCESS_TOKEN_KEY);
    storage.remove(REFRESH_TOKEN_KEY);
  }

  /**
   * Attempt to refresh the access token using the stored refresh token.
   * Returns true if successful (new tokens saved), false otherwise.
   */
  async #refreshTokens(): Promise<boolean> {
    const refreshToken = this.#cachedRefreshToken;
    if (!refreshToken) return false;

    try {
      const data = await cfPost<{
        access_token: string;
        refresh_token: string;
      }>(
        '/auth/refresh',
        { refresh_token: refreshToken },
        { skipAuthIntercept: true, noRetry: true },
      );
      this.#saveTokens(data.access_token, data.refresh_token);
      authLog.debug('Token refresh succeeded');
      return true;
    } catch (error: unknown) {
      const status = (error as { status?: number }).status;
      if (status === 401) {
        // Refresh token is invalid/expired — session is dead
        authLog.warn('Refresh token invalid, clearing session');
        this.#clearTokens();
        this.#currentUserId = null;
        return false;
      }
      // Network error — don't clear, maybe we're offline
      authLog.warn('Token refresh network error', { status });
      return false;
    }
  }

  #handleAuthExpired(): void {
    authLog.warn('Auth expired — all tokens invalid');
    this.#clearTokens();
    this.#currentUserId = null;
    Sentry.setUser(null);
  }

  /** Decode the `sub` claim from a JWT without verifying signature (local offline use only) */
  #decodeUserIdFromJwt(token: string): string | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1])) as { sub?: string };
      return payload.sub ?? null;
    } catch {
      return null;
    }
  }
}
