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

import { storage } from '@/services/infra/localStorage';
import type { AuthUser, GetCurrentUserResponse, IAuthService } from '@/services/types/IAuthService';
import { handleError } from '@/utils/errorPipeline';
import { isAbortError, isNetworkError } from '@/utils/errorUtils';
import { authLog } from '@/utils/logger';
import { clearClaimNonce, isMiniProgram, readClaimNonce } from '@/utils/miniProgram';
import { withTimeout } from '@/utils/withTimeout';

import {
  type AccessTokenClaims,
  isAccessTokenClaimsExpired,
  parseAccessTokenClaims,
} from './accessTokenClaims';
import {
  parseAnonymousAuthResponse,
  parseClaimAuthResponse,
  parseCurrentUserResponse,
  parseEmailAuthResponse,
  parseRefreshResponse,
  parseResetPasswordResponse,
} from './authResponseCodec';
import {
  cfGet,
  cfPost,
  cfPut,
  CloudflareHttpError,
  CloudflareResponseJsonError,
  setOnAuthExpired,
  setRefreshHandler,
  setTokenProvider,
} from './cfFetch';
import { parseSuccessResponse } from './responseCodecs';

const ACCESS_TOKEN_KEY = 'cf_auth_token';
const REFRESH_TOKEN_KEY = 'cf_refresh_token';
const AUTH_USER_ID_KEY = 'cf_auth_user_id';
const AUTH_IS_ANONYMOUS_KEY = 'cf_auth_is_anonymous';
const AUTH_HAS_WECHAT_KEY = 'cf_auth_has_wechat';

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
    return cfGet('/auth/user', parseCurrentUserResponse);
  }

  async signInAnonymously(): Promise<string> {
    const data = await cfPost('/auth/anonymous', undefined, parseAnonymousAuthResponse, {
      skipAuthIntercept: true,
    });

    this.#saveTokens(data.access_token, data.refresh_token);
    this.#setCurrentUser(data.user);
    return data.user.id;
  }

  async signUpWithEmail(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<{ userId: string; user: AuthUser }> {
    const data = await cfPost(
      '/auth/signup',
      { email, password, displayName },
      parseEmailAuthResponse,
    );

    this.#saveTokens(data.access_token, data.refresh_token);
    this.#setCurrentUser(data.user);
    return { userId: data.user.id, user: data.user };
  }

  async signInWithEmail(email: string, password: string): Promise<string> {
    const data = await cfPost('/auth/signin', { email, password }, parseEmailAuthResponse, {
      skipAuthIntercept: true,
    });

    this.#saveTokens(data.access_token, data.refresh_token);
    this.#setCurrentUser(data.user);
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
    await cfPut('/auth/profile', updates, parseSuccessResponse);
  }

  async signOut(): Promise<void> {
    try {
      await cfPost('/auth/signout', undefined, parseSuccessResponse);
    } catch (error) {
      handleError(error, {
        label: '退出登录同步',
        logger: authLog,
        expectedCodes: [401, 404],
        feedback: false,
      });
    }
    this.#clearSession();
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await cfPut('/auth/password', { oldPassword, newPassword }, parseSuccessResponse);
    // Server bumps tokenVersion — current tokens still work until expiry
    // but refresh will get new version. Force re-login for security:
    this.#clearSession();
  }

  async forgotPassword(email: string): Promise<void> {
    await cfPost('/auth/forgot-password', { email }, parseSuccessResponse, {
      skipAuthIntercept: true,
    });
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<string> {
    const data = await cfPost(
      '/auth/reset-password',
      { email, code, newPassword },
      parseResetPasswordResponse,
      { skipAuthIntercept: true },
    );

    this.#saveTokens(data.access_token, data.refresh_token);
    this.#setCurrentUser(data.user);
    return data.user.id;
  }

  /**
   * Attempts to claim the token prepared by the mini-program native side using a nonce.
   * Returns true and sets session on success; returns false on failure.
   */
  async #tryClaimToken(nonce: string): Promise<boolean> {
    try {
      const data = await cfPost('/auth/claim', { nonce }, parseClaimAuthResponse, {
        skipAuthIntercept: true,
      });

      this.#saveTokens(data.access_token, data.refresh_token);
      this.#setCurrentUser(data.user);
      clearClaimNonce();
      return true;
    } catch (error) {
      clearClaimNonce();
      if (error instanceof CloudflareHttpError && (error.status === 404 || error.status === 410)) {
        authLog.warn('WeChat claim unavailable', { reason: error.reason });
        return false;
      }
      throw error;
    }
  }

  /**
   * Attempts to bind a WeChat openid to the currently authenticated user using a nonce.
   * Returns true on success; returns false on failure (e.g. OPENID_ALREADY_BOUND).
   */
  async #tryClaimBind(nonce: string): Promise<boolean> {
    try {
      await cfPost('/auth/claim-bind', { nonce }, parseSuccessResponse);
      this.#hasWechat = true;
      storage.set(AUTH_HAS_WECHAT_KEY, true);
      clearClaimNonce();
      authLog.info('WeChat bind succeeded', { userId: this.#currentUserId });
      return true;
    } catch (error: unknown) {
      clearClaimNonce();
      if (
        error instanceof CloudflareHttpError &&
        (error.status === 404 || error.status === 410 || error.reason === 'OPENID_ALREADY_BOUND')
      ) {
        authLog.warn('WeChat bind unavailable', { reason: error.reason });
        return false;
      }
      throw error;
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
    if (!accessToken) {
      this.#clearSession();
      return null;
    }

    this.#cachedAccessToken = accessToken;
    this.#cachedRefreshToken = refreshToken;

    let persistedClaims: AccessTokenClaims | null;
    try {
      persistedClaims = parseAccessTokenClaims(accessToken);
    } catch (error) {
      authLog.warn('initAuth: persisted access token is malformed', {
        error: error instanceof Error ? error.message : String(error),
      });
      persistedClaims = null;
    }

    // Pre-check: if access token is already expired, skip the doomed GET and
    // go straight to refresh (saves ~200ms RTT on every cold start in WeChat WebView)
    if (persistedClaims === null || isAccessTokenClaimsExpired(persistedClaims)) {
      authLog.debug('initAuth: access token expired locally, skipping GET /auth/user');
      if (refreshToken) {
        const refreshResult = await this.#refreshTokens();
        if (refreshResult === 'refreshed') {
          return this.#fetchAndCacheUser();
        }
        if (refreshResult === 'offline') {
          if (persistedClaims !== null) return this.#restoreOfflineUser(persistedClaims);
          this.#clearSession();
          return null;
        }
      }
      // No refresh token or refresh failed
      this.#clearSession();
      return null;
    }

    try {
      const resp = await cfGet('/auth/user', parseCurrentUserResponse, {
        skipAuthIntercept: true,
        noRetry: true,
      });
      const { user } = resp.data;
      this.#setCurrentUser(user);
      return this.#currentUserId;
    } catch (error: unknown) {
      if (error instanceof CloudflareHttpError && (error.status === 401 || error.status === 404)) {
        // Access token expired/revoked — try refresh
        if (refreshToken) {
          const refreshResult = await this.#refreshTokens();
          if (refreshResult === 'refreshed') {
            return this.#fetchAndCacheUser();
          }
          if (refreshResult === 'offline') return this.#restoreOfflineUser(persistedClaims);
        }
        // No refresh token or refresh failed
        this.#clearSession();
        return null;
      }

      if (isNetworkError(error) || isAbortError(error)) {
        authLog.warn('initAuth: network error, keeping tokens for offline use');
        return this.#restoreOfflineUser(persistedClaims);
      }
      throw error;
    }
  }

  // ── Private: Token management ─────────────────────────────────────────────

  #saveTokens(accessToken: string, refreshToken: string): void {
    this.#cachedAccessToken = accessToken;
    this.#cachedRefreshToken = refreshToken;
    storage.set(ACCESS_TOKEN_KEY, accessToken);
    storage.set(REFRESH_TOKEN_KEY, refreshToken);
  }

  #requestRefreshTokenPair(refreshToken: string) {
    return cfPost('/auth/refresh', { refresh_token: refreshToken }, parseRefreshResponse, {
      skipAuthIntercept: true,
      noRetry: true,
    });
  }

  #clearStoredSession(): void {
    this.#cachedAccessToken = null;
    this.#cachedRefreshToken = null;
    storage.remove(ACCESS_TOKEN_KEY);
    storage.remove(REFRESH_TOKEN_KEY);
    storage.remove(AUTH_USER_ID_KEY);
    storage.remove(AUTH_IS_ANONYMOUS_KEY);
    storage.remove(AUTH_HAS_WECHAT_KEY);
  }

  #setCurrentUser(user: AuthUser): void {
    this.#currentUserId = user.id;
    this.#isAnonymous = user.is_anonymous;
    this.#hasWechat = user.has_wechat;
    this.#needsWechatLogin = false;
    storage.set(AUTH_USER_ID_KEY, user.id);
    storage.set(AUTH_IS_ANONYMOUS_KEY, user.is_anonymous);
    storage.set(AUTH_HAS_WECHAT_KEY, user.has_wechat);
    Sentry.setUser({ id: user.id });
  }

  #clearSession(): void {
    this.#clearStoredSession();
    this.#currentUserId = null;
    this.#isAnonymous = false;
    this.#hasWechat = false;
    Sentry.setUser(null);
  }

  /**
   * Attempt to refresh the access token using the stored refresh token.
   * Returns true if successful (new tokens saved), false otherwise.
   */
  async #refreshTokens(): Promise<'refreshed' | 'expired' | 'offline'> {
    const refreshToken = this.#cachedRefreshToken;
    if (!refreshToken) return 'expired';

    try {
      let data;
      try {
        data = await this.#requestRefreshTokenPair(refreshToken);
      } catch (error) {
        if (!(error instanceof CloudflareResponseJsonError)) throw error;
        authLog.warn('Refresh response body unreadable, retrying once');
        data = await this.#requestRefreshTokenPair(refreshToken);
      }
      this.#saveTokens(data.access_token, data.refresh_token);
      authLog.debug('Token refresh succeeded');
      return 'refreshed';
    } catch (error: unknown) {
      if (error instanceof CloudflareHttpError && error.status === 401) {
        // Refresh token is invalid/expired — session is dead
        authLog.warn('Refresh token invalid, clearing session');
        return 'expired';
      }
      if (isNetworkError(error) || isAbortError(error)) {
        authLog.warn('Token refresh network error');
        return 'offline';
      }
      throw error;
    }
  }

  #handleAuthExpired(): void {
    authLog.warn('Auth expired — all tokens invalid');
    this.#clearSession();
    this.#needsWechatLogin = isMiniProgram();
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
      const resp = await cfGet('/auth/user', parseCurrentUserResponse, {
        skipAuthIntercept: true,
        noRetry: true,
      });
      const { user } = resp.data;
      this.#setCurrentUser(user);
      return this.#currentUserId;
    } catch (error: unknown) {
      if (error instanceof CloudflareHttpError && (error.status === 401 || error.status === 404)) {
        authLog.warn('Refreshed session rejected', { reason: error.reason });
        this.#clearSession();
        return null;
      }
      if (isNetworkError(error) || isAbortError(error)) {
        const accessToken = this.#cachedAccessToken;
        if (accessToken === null) throw new Error('Refreshed access token is missing');
        authLog.warn('User refresh verification offline, keeping tokens');
        return this.#restoreOfflineUser(parseAccessTokenClaims(accessToken));
      }
      throw error;
    }
  }

  /** Restore the local principal from a previously parsed Worker token while offline. */
  #restoreOfflineUser(claims: AccessTokenClaims): string | null {
    const userId = storage.getString(AUTH_USER_ID_KEY);
    const isAnonymous = storage.getBoolean(AUTH_IS_ANONYMOUS_KEY);
    const hasWechat = storage.getBoolean(AUTH_HAS_WECHAT_KEY);
    if (userId !== claims.sub || isAnonymous === undefined || hasWechat === undefined) {
      authLog.warn('Offline auth identity does not match the access token');
      this.#clearSession();
      return null;
    }
    this.#currentUserId = claims.sub;
    this.#isAnonymous = isAnonymous;
    this.#hasWechat = hasWechat;
    this.#needsWechatLogin = false;
    Sentry.setUser({ id: claims.sub });
    return claims.sub;
  }
}
