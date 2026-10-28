/**
 * CFAuthService — Cloudflare Workers JWT auth service.
 *
 * Drives sign-in / sign-up / restore flows against `/auth/*` and commits identity into the
 * shared `AuthTokenStore`. Token refresh and 401 interception live in `ApiClient`; this
 * service only decides what a refresh outcome means for the local principal.
 *
 * `waitForInit()` must be awaited before calling any other method.
 */

import * as Sentry from '@sentry/react-native';

import {
  type AccessTokenClaims,
  isAccessTokenClaimsExpired,
  parseAccessTokenClaims,
} from '@/platform/auth/accessTokenClaims';
import type { AuthTokenStore } from '@/platform/auth/AuthTokenStore';
import type { ApiClient } from '@/platform/http/ApiClient';
import { ApiError } from '@/platform/http/ApiError';
import { storage } from '@/services/infra/localStorage';
import type {
  AuthSession,
  AuthUser,
  GetCurrentUserResponse,
  IAuthService,
} from '@/services/types/IAuthService';
import { handleError } from '@/utils/errorPipeline';
import { isAbortError, isNetworkError } from '@/utils/errorUtils';
import { authLog } from '@/utils/logger';
import { clearClaimNonce, isMiniProgram, readClaimNonce } from '@/utils/miniProgram';
import { withTimeout } from '@/utils/withTimeout';

import {
  parseAnonymousAuthResponse,
  parseClaimAuthResponse,
  parseCurrentUserResponse,
  parseEmailAuthResponse,
  parseResetPasswordResponse,
} from './authResponseCodec';
import { parseSuccessResponse } from './responseCodecs';

const AUTH_USER_ID_KEY = 'cf_auth_user_id';
const AUTH_IS_ANONYMOUS_KEY = 'cf_auth_is_anonymous';
const AUTH_HAS_WECHAT_KEY = 'cf_auth_has_wechat';

interface CFAuthServiceDeps {
  readonly apiClient: ApiClient;
  readonly tokens: AuthTokenStore;
}

function isHttpStatus(error: unknown, ...statuses: readonly number[]): error is ApiError {
  return error instanceof ApiError && error.isHttp() && statuses.includes(error.status);
}

export class CFAuthService implements IAuthService {
  readonly #api: ApiClient;
  readonly #tokens: AuthTokenStore;
  #isAnonymous = false;
  #hasWechat = false;
  #needsWechatLogin = false;
  #initPromise: Promise<void>;
  #initError: Error | null = null;
  readonly #authExpiredCallbacks = new Set<() => void>();

  get needsWechatLogin(): boolean {
    return this.#needsWechatLogin;
  }

  constructor({ apiClient, tokens }: CFAuthServiceDeps) {
    this.#api = apiClient;
    this.#tokens = tokens;
    tokens.subscribeExpired(() => this.#handleAuthExpired());
    this.#initPromise = this.#autoSignIn();
  }

  async #autoSignIn(): Promise<void> {
    this.#initError = null;
    try {
      const existingUserId = await this.initAuth();

      if (existingUserId && !isMiniProgram()) {
        authLog.info('Restored session', { userId: existingUserId });
        return;
      }

      if (existingUserId && isMiniProgram()) {
        const claimNonce = readClaimNonce();
        if (claimNonce && this.#isAnonymous) {
          const claimed = await this.#tryClaimToken(claimNonce);
          if (claimed) {
            authLog.info('Claim upgrade from anonymous succeeded', {
              userId: this.getCurrentUserId(),
            });
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
        const claimNonce = readClaimNonce();
        if (claimNonce) {
          const claimed = await this.#tryClaimToken(claimNonce);
          if (claimed) {
            authLog.info('Claim flow succeeded', { userId: this.getCurrentUserId() });
            return;
          }
          authLog.warn('Claim flow failed, showing login button');
        } else {
          authLog.info('Mini-program: first visit, showing login button');
        }
        this.#needsWechatLogin = true;
      }
    } catch (error) {
      this.#initError = error instanceof Error ? error : new Error(String(error));
    }
  }

  async waitForInit(options?: { retry: boolean }): Promise<void> {
    if (options?.retry) this.#initPromise = this.#autoSignIn();
    await withTimeout(this.#initPromise, 25000, 'autoSignIn');
    if (this.#initError !== null) throw this.#initError;
  }

  async ensureAuthenticated(): Promise<string> {
    const session = this.#tokens.session;
    if (session !== null) return session.userId;
    const restored = await this.initAuth();
    if (restored) return restored;
    return this.signInAnonymously();
  }

  isConfigured(): boolean {
    return true;
  }

  getCurrentUserId(): string | null {
    return this.#tokens.session?.userId ?? null;
  }

  getAuthSession(): AuthSession | null {
    return this.#tokens.session;
  }

  subscribeAuth(callback: () => void): () => void {
    return this.#tokens.subscribeSession(callback);
  }

  async getCurrentUser(signal?: AbortSignal): Promise<GetCurrentUserResponse | null> {
    if (this.#tokens.accessToken === null) return null;
    return this.#api.json({
      method: 'GET',
      path: '/auth/user',
      auth: 'required',
      idempotent: true,
      decode: parseCurrentUserResponse,
      signal,
    });
  }

  async signInAnonymously(): Promise<string> {
    const data = await this.#api.json({
      method: 'POST',
      path: '/auth/anonymous',
      auth: 'none',
      idempotent: false,
      decode: parseAnonymousAuthResponse,
    });
    this.#tokens.saveTokens(data.access_token, data.refresh_token);
    this.#setCurrentUser(data.user);
    return data.user.id;
  }

  async signUpWithEmail(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<{ userId: string; user: AuthUser }> {
    const data = await this.#api.json({
      method: 'POST',
      path: '/auth/signup',
      auth: 'required',
      idempotent: false,
      body: { email, password, displayName },
      decode: parseEmailAuthResponse,
    });
    this.#tokens.saveTokens(data.access_token, data.refresh_token);
    this.#setCurrentUser(data.user);
    return { userId: data.user.id, user: data.user };
  }

  async signInWithEmail(email: string, password: string): Promise<string> {
    const data = await this.#api.json({
      method: 'POST',
      path: '/auth/signin',
      auth: 'none',
      idempotent: false,
      body: { email, password },
      decode: parseEmailAuthResponse,
    });
    this.#tokens.saveTokens(data.access_token, data.refresh_token);
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
    await this.#api.json({
      method: 'PUT',
      path: '/auth/profile',
      auth: 'required',
      idempotent: true,
      body: updates,
      decode: parseSuccessResponse,
    });
  }

  async signOut(): Promise<void> {
    const session = this.#tokens.session;
    try {
      await this.#api.json({
        method: 'POST',
        path: '/auth/signout',
        auth: 'required',
        idempotent: true,
        decode: parseSuccessResponse,
      });
    } catch (error) {
      handleError(error, {
        label: '退出登录同步',
        logger: authLog,
        expectedCodes: [401, 404],
        feedback: false,
      });
    }
    if (this.#tokens.session !== session) {
      throw new DOMException('Authentication changed', 'AbortError');
    }
    this.#clearSession();
  }

  async changePassword(oldPassword: string, newPassword: string): Promise<void> {
    await this.#api.json({
      method: 'PUT',
      path: '/auth/password',
      auth: 'required',
      idempotent: false,
      body: { oldPassword, newPassword },
      decode: parseSuccessResponse,
    });
    // The server bumps tokenVersion; force a clean re-login.
    this.#clearSession();
  }

  async forgotPassword(email: string): Promise<void> {
    await this.#api.json({
      method: 'POST',
      path: '/auth/forgot-password',
      auth: 'none',
      idempotent: false,
      body: { email },
      decode: parseSuccessResponse,
    });
  }

  async resetPassword(email: string, code: string, newPassword: string): Promise<string> {
    const data = await this.#api.json({
      method: 'POST',
      path: '/auth/reset-password',
      auth: 'none',
      idempotent: false,
      body: { email, code, newPassword },
      decode: parseResetPasswordResponse,
    });
    this.#tokens.saveTokens(data.access_token, data.refresh_token);
    this.#setCurrentUser(data.user);
    return data.user.id;
  }

  async #tryClaimToken(nonce: string): Promise<boolean> {
    try {
      const data = await this.#api.json({
        method: 'POST',
        path: '/auth/claim',
        auth: 'none',
        idempotent: false,
        body: { nonce },
        decode: parseClaimAuthResponse,
      });
      this.#tokens.saveTokens(data.access_token, data.refresh_token);
      this.#setCurrentUser(data.user);
      clearClaimNonce();
      return true;
    } catch (error) {
      clearClaimNonce();
      if (isHttpStatus(error, 404, 410)) {
        authLog.warn('WeChat claim unavailable', { reason: error.reason });
        return false;
      }
      throw error;
    }
  }

  async #tryClaimBind(nonce: string): Promise<boolean> {
    try {
      await this.#api.json({
        method: 'POST',
        path: '/auth/claim-bind',
        auth: 'required',
        idempotent: false,
        body: { nonce },
        decode: parseSuccessResponse,
      });
      this.#hasWechat = true;
      storage.set(AUTH_HAS_WECHAT_KEY, true);
      clearClaimNonce();
      authLog.info('WeChat bind succeeded', { userId: this.getCurrentUserId() });
      return true;
    } catch (error: unknown) {
      clearClaimNonce();
      if (
        isHttpStatus(error, 404, 410) ||
        (error instanceof ApiError && error.reason === 'OPENID_ALREADY_BOUND')
      ) {
        authLog.warn('WeChat bind unavailable', { reason: error.reason });
        return false;
      }
      throw error;
    }
  }

  /**
   * Restore the principal from persisted tokens: verify online when the access token looks
   * valid, otherwise refresh; stay offline on network failure; clear on rejection.
   */
  async initAuth(): Promise<string | null> {
    const accessToken = this.#tokens.accessToken;
    if (accessToken === null) {
      this.#clearSession();
      return null;
    }

    let persistedClaims: AccessTokenClaims | null;
    try {
      persistedClaims = parseAccessTokenClaims(accessToken);
    } catch (error) {
      authLog.warn('initAuth: persisted access token is malformed', {
        error: error instanceof Error ? error.message : String(error),
      });
      persistedClaims = null;
    }

    if (persistedClaims === null || isAccessTokenClaimsExpired(persistedClaims)) {
      authLog.debug('initAuth: access token expired locally, refreshing first');
      return this.#restoreThroughRefresh(persistedClaims);
    }

    try {
      const { user } = (await this.#fetchCurrentUser()).data;
      this.#setCurrentUser(user);
      return user.id;
    } catch (error: unknown) {
      if (isHttpStatus(error, 401, 404)) return this.#restoreThroughRefresh(persistedClaims);
      if (isNetworkError(error) || isAbortError(error)) {
        authLog.warn('initAuth: network error, keeping tokens for offline use');
        return this.#restoreOfflineUser(persistedClaims);
      }
      throw error;
    }
  }

  async #restoreThroughRefresh(persistedClaims: AccessTokenClaims | null): Promise<string | null> {
    const outcome = await this.#api.refresh();
    if (outcome === 'refreshed') return this.#fetchAndCacheUser();
    if (outcome === 'offline') {
      if (persistedClaims !== null) return this.#restoreOfflineUser(persistedClaims);
      this.#clearSession();
      return null;
    }
    // 'expired': the token store already cleared itself and notified listeners.
    this.#clearLocalPrincipal();
    return null;
  }

  #fetchCurrentUser(): Promise<GetCurrentUserResponse> {
    return this.#api.json({
      method: 'GET',
      path: '/auth/user',
      auth: 'passthrough',
      idempotent: false,
      decode: parseCurrentUserResponse,
    });
  }

  #setCurrentUser(user: AuthUser): void {
    this.#isAnonymous = user.is_anonymous;
    this.#hasWechat = user.has_wechat;
    this.#needsWechatLogin = false;
    storage.set(AUTH_USER_ID_KEY, user.id);
    storage.set(AUTH_IS_ANONYMOUS_KEY, user.is_anonymous);
    storage.set(AUTH_HAS_WECHAT_KEY, user.has_wechat);
    Sentry.setUser({ id: user.id });
    this.#tokens.setSession({ userId: user.id, initialUser: user });
  }

  #clearLocalPrincipal(): void {
    storage.remove(AUTH_USER_ID_KEY);
    storage.remove(AUTH_IS_ANONYMOUS_KEY);
    storage.remove(AUTH_HAS_WECHAT_KEY);
    this.#isAnonymous = false;
    this.#hasWechat = false;
    this.#needsWechatLogin = isMiniProgram();
    Sentry.setUser(null);
  }

  #clearSession(): void {
    this.#tokens.clearTokens();
    this.#clearLocalPrincipal();
    this.#tokens.setSession(null);
  }

  #handleAuthExpired(): void {
    authLog.warn('Auth expired — all tokens invalid');
    this.#clearLocalPrincipal();
    this.#authExpiredCallbacks.forEach((cb) => cb());
  }

  onAuthExpired(callback: () => void): () => void {
    this.#authExpiredCallbacks.add(callback);
    return () => this.#authExpiredCallbacks.delete(callback);
  }

  async #fetchAndCacheUser(): Promise<string | null> {
    try {
      const { user } = (await this.#fetchCurrentUser()).data;
      this.#setCurrentUser(user);
      return user.id;
    } catch (error: unknown) {
      if (isHttpStatus(error, 401, 404)) {
        authLog.warn('Refreshed session rejected', { reason: error.reason });
        this.#clearSession();
        return null;
      }
      if (isNetworkError(error) || isAbortError(error)) {
        const accessToken = this.#tokens.accessToken;
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
    this.#isAnonymous = isAnonymous;
    this.#hasWechat = hasWechat;
    this.#needsWechatLogin = false;
    Sentry.setUser({ id: claims.sub });
    this.#tokens.setSession({ userId: claims.sub, initialUser: null });
    return claims.sub;
  }
}
