/**
 * CFAuthService — Cloudflare Workers JWT auth service.
 *
 * Responsibilities:
 * - Implements the IAuthService interface
 * - Calls Workers /auth/* endpoints over HTTP
 * - Manages access token (short-lived JWT, 1h) + refresh token (90d, rotation)
 * - Persists tokens in MMKV
 * - Automatic 401 token refresh driven by the cfFetch interceptor
 *
 * Not responsible for:
 * - Game logic or room management
 * - WeChat auth flow details (handled by WeChatAuthProxy DO for code2Session)
 *
 * Boundary constraints:
 * - Synchronously registers tokenProvider / refreshHandler / onAuthExpired in the constructor
 * - initReady() must be awaited before calling any other methods
 */

import * as Sentry from '@sentry/react-native';
import { getAllRoleIds, getRoleSpec } from '@werewolf/game-engine/werewolf/models/roles';

import { storage } from '@/lib/storage';
import type { AuthUser, GetCurrentUserResponse, IAuthService } from '@/services/types/IAuthService';
import { handleError } from '@/utils/errorPipeline';
import { authLog } from '@/utils/logger';
import { clearClaimNonce, isMiniProgram, readClaimNonce } from '@/utils/miniProgram';
import { withTimeout } from '@/utils/withTimeout';

import {
  cfGet,
  cfPost,
  cfPut,
  isAccessTokenExpired,
  setOnAuthExpired,
  setRefreshHandler,
  setTokenProvider,
} from './cfFetch';

const ACCESS_TOKEN_KEY = 'cf_auth_token';
const REFRESH_TOKEN_KEY = 'cf_refresh_token';

/**
 * CFAuthService — Cloudflare Workers auth service implementation.
 *
 * Responsibilities: JWT token management, anonymous/email login, WeChat claim flow, auto refresh.
 */
export class CFAuthService implements IAuthService {
  #currentUserId: string | null = null;
  #cachedAccessToken: string | null = null;
  #cachedRefreshToken: string | null = null;
  #isAnonymous = false;
  #hasWechat = false;
  #generatedName: string | null = null;
  #needsWechatLogin = false;
  readonly #initPromise: Promise<void>;
  readonly #authExpiredCallbacks = new Set<() => void>();

  get needsWechatLogin(): boolean {
    return this.#needsWechatLogin;
  }

  constructor() {
    // Register token provider so cfFetch auto-injects Bearer header
    setTokenProvider(() => this.#cachedAccessToken);
    // Register refresh handler for 401 interception
    setRefreshHandler(() => this.#refreshTokens());
    // Register auth expired callback: cfFetch fires this when both tokens are dead
    setOnAuthExpired(() => this.#handleAuthExpired());

    this.#initPromise = this.#autoSignIn();
  }

  async #autoSignIn(): Promise<void> {
    try {
      const existingUserId = await this.initAuth();

      if (existingUserId && !isMiniProgram()) {
        authLog.info('Restored session', { userId: existingUserId });
        return;
      }

      if (existingUserId && isMiniProgram()) {
        // Session exists: opportunistically attempt nonce claim (bind/upgrade), no auto reLaunch
        const claimNonce = readClaimNonce();
        if (claimNonce && this.#isAnonymous) {
          const claimed = await this.#tryClaimToken(claimNonce);
          if (claimed) {
            authLog.info('Claim upgrade from anonymous succeeded', { userId: this.#currentUserId });
          } else {
            authLog.warn('Claim upgrade failed, keeping anonymous session');
          }
        } else if (claimNonce && !this.#hasWechat) {
          await this.#tryClaimBind(claimNonce);
        }
        authLog.info('Restored session', { userId: existingUserId });
        return;
      }

      if (isMiniProgram()) {
        // No session — attempt claim or show login entry point
        const claimNonce = readClaimNonce();
        if (claimNonce) {
          const claimed = await this.#tryClaimToken(claimNonce);
          if (claimed) {
            authLog.info('Claim flow succeeded', { userId: this.#currentUserId });
            return;
          }
          authLog.warn('Claim flow failed, showing login button');
        } else {
          authLog.info('Mini-program: first visit, showing login button');
        }
        this.#needsWechatLogin = true;
      }
    } catch (error) {
      handleError(error, { label: 'CFAuth.autoSignIn', logger: authLog, feedback: false });
    }
  }

  async waitForInit(): Promise<void> {
    await withTimeout(this.#initPromise, 25000, 'autoSignIn');
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

  /**
   * Attempts to claim the token prepared by the mini-program native side using a nonce.
   * Returns true and sets session on success; returns false on failure.
   */
  async #tryClaimToken(nonce: string): Promise<boolean> {
    try {
      const data = await cfPost<{
        access_token: string;
        refresh_token: string;
        user: { id: string; is_anonymous: boolean };
      }>('/auth/claim', { nonce }, { skipAuthIntercept: true });

      this.#saveTokens(data.access_token, data.refresh_token);
      this.#currentUserId = data.user.id;
      this.#isAnonymous = data.user.is_anonymous;
      this.#hasWechat = true;
      clearClaimNonce();
      Sentry.setUser({ id: data.user.id });
      return true;
    } catch (error: unknown) {
      // Per /auth/claim contract: 404 CLAIM_NOT_FOUND and 410 CLAIM_EXPIRED are normal user-layer flows.
      // 400 (validation) / 500 / network errors go to Sentry.
      handleError(error, {
        label: 'tryClaimToken',
        logger: authLog,
        expectedCodes: [404, 410],
        feedback: false,
      });
      clearClaimNonce();
      return false;
    }
  }

  /**
   * Attempts to bind a WeChat openid to the currently authenticated user using a nonce.
   * Returns true on success; returns false on failure (e.g. OPENID_ALREADY_BOUND).
   */
  async #tryClaimBind(nonce: string): Promise<boolean> {
    try {
      await cfPost<{ success: true }>('/auth/claim-bind', { nonce });
      this.#hasWechat = true;
      clearClaimNonce();
      authLog.info('WeChat bind succeeded', { userId: this.#currentUserId });
      return true;
    } catch (error) {
      clearClaimNonce();
      const reason = (error as { reason?: string }).reason;
      if (reason === 'OPENID_ALREADY_BOUND') {
        authLog.warn('WeChat bind failed: openid already bound to another user');
      } else {
        authLog.warn('WeChat bind failed', { reason });
      }
      return false;
    }
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

    // Pre-check: if access token is already expired, skip the doomed GET and
    // go straight to refresh (saves ~200ms RTT on every cold start in WeChat WebView)
    if (isAccessTokenExpired(accessToken)) {
      authLog.debug('initAuth: access token expired locally, skipping GET /auth/user');
      if (refreshToken) {
        const refreshed = await this.#refreshTokens();
        if (refreshed) {
          return this.#fetchAndCacheUser();
        }
      }
      // No refresh token or refresh failed
      this.#clearTokens();
      return null;
    }

    try {
      const resp = await cfGet<GetCurrentUserResponse>('/auth/user', {
        skipAuthIntercept: true,
        noRetry: true,
      });
      const { user } = resp.data;
      this.#currentUserId = user.id;
      this.#isAnonymous = user.is_anonymous ?? false;
      this.#hasWechat = user.has_wechat ?? false;
      Sentry.setUser({ id: user.id });
      return this.#currentUserId;
    } catch (error: unknown) {
      const status = (error as { status?: number }).status;

      if (status === 401 || status === 404) {
        // Access token expired/revoked — try refresh
        if (refreshToken) {
          const refreshed = await this.#refreshTokens();
          if (refreshed) {
            return this.#fetchAndCacheUser();
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
    const idx1 = arr[0]! % adjectives.length;
    const idx2 = arr[1]! % nouns.length;

    this.#generatedName = adjectives[idx1]! + '的' + nouns[idx2]!;
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
  async #refreshTokens(): Promise<'refreshed' | 'expired' | 'offline'> {
    const refreshToken = this.#cachedRefreshToken;
    if (!refreshToken) return 'expired';

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
      return 'refreshed';
    } catch (error: unknown) {
      const status = (error as { status?: number }).status;
      if (status === 401) {
        // Refresh token is invalid/expired — session is dead
        authLog.warn('Refresh token invalid, clearing session');
        return 'expired';
      }
      // Network error — don't clear tokens, user may be offline
      authLog.warn('Token refresh network error', { status });
      return 'offline';
    }
  }

  #handleAuthExpired(): void {
    authLog.warn('Auth expired — all tokens invalid');
    this.#needsWechatLogin = isMiniProgram();
    this.#clearTokens();
    this.#currentUserId = null;
    Sentry.setUser(null);
    this.#authExpiredCallbacks.forEach((cb) => cb());
  }

  onAuthExpired(callback: () => void): () => void {
    this.#authExpiredCallbacks.add(callback);
    return () => this.#authExpiredCallbacks.delete(callback);
  }

  /**
   * Fetch /auth/user and cache the result. Used after successful token refresh.
   * Returns userId on success, null on failure (clears tokens).
   */
  async #fetchAndCacheUser(): Promise<string | null> {
    try {
      const resp = await cfGet<GetCurrentUserResponse>('/auth/user', {
        skipAuthIntercept: true,
        noRetry: true,
      });
      const { user } = resp.data;
      this.#currentUserId = user.id;
      this.#isAnonymous = user.is_anonymous ?? false;
      this.#hasWechat = user.has_wechat ?? false;
      Sentry.setUser({ id: user.id });
      return this.#currentUserId;
    } catch (error: unknown) {
      // Per /auth/user contract: 401 (revoked/invalid — may race even right after refresh) and 404 (USER_NOT_FOUND)
      // are known terminal states. 500 / network errors go to Sentry.
      handleError(error, {
        label: 'fetchAndCacheUser',
        logger: authLog,
        expectedCodes: [401, 404],
        feedback: false,
      });
      this.#clearTokens();
      return null;
    }
  }

  /** Decode the `sub` claim from a JWT without verifying signature (local offline use only) */
  #decodeUserIdFromJwt(token: string): string | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = JSON.parse(atob(parts[1]!)) as { sub?: string };
      return payload.sub ?? null;
    } catch {
      return null;
    }
  }
}
