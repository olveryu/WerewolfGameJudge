/**
 * AuthTokenStore — token pair persistence and identity snapshot shared by the HTTP client
 * and the auth service.
 *
 * Holds the access/refresh token pair (persisted) and the current `AuthSession` (in memory).
 * The HTTP client reads tokens and reports expiry; the auth service drives sign-in flows and
 * commits identity changes. Neither layer registers callbacks on the other.
 */
import type { AuthSession } from '@/services/types/IAuthService';

/** Persistence surface required by the store (MMKV-compatible). */
export interface TokenStorage {
  getString(key: string): string | undefined;
  set(key: string, value: string): void;
  remove(key: string): void;
}

const ACCESS_TOKEN_KEY = 'cf_auth_token';
const REFRESH_TOKEN_KEY = 'cf_refresh_token';

export class AuthTokenStore {
  readonly #storage: TokenStorage;
  readonly #sessionListeners = new Set<() => void>();
  readonly #expiredListeners = new Set<() => void>();
  #accessToken: string | null;
  #refreshToken: string | null;
  #session: AuthSession | null = null;

  constructor(storage: TokenStorage) {
    this.#storage = storage;
    this.#accessToken = storage.getString(ACCESS_TOKEN_KEY) ?? null;
    this.#refreshToken = storage.getString(REFRESH_TOKEN_KEY) ?? null;
  }

  get accessToken(): string | null {
    return this.#accessToken;
  }

  get refreshToken(): string | null {
    return this.#refreshToken;
  }

  /** Stable identity snapshot; requests bind to it so an identity change aborts them. */
  get session(): AuthSession | null {
    return this.#session;
  }

  saveTokens(accessToken: string, refreshToken: string): void {
    if (accessToken.length === 0 || refreshToken.length === 0) {
      throw new Error('Auth tokens must be non-empty');
    }
    this.#accessToken = accessToken;
    this.#refreshToken = refreshToken;
    this.#storage.set(ACCESS_TOKEN_KEY, accessToken);
    this.#storage.set(REFRESH_TOKEN_KEY, refreshToken);
  }

  clearTokens(): void {
    this.#accessToken = null;
    this.#refreshToken = null;
    this.#storage.remove(ACCESS_TOKEN_KEY);
    this.#storage.remove(REFRESH_TOKEN_KEY);
  }

  /** Commit a new identity (or sign-out with null) and notify session listeners. */
  setSession(session: AuthSession | null): void {
    this.#session = session;
    for (const listener of this.#sessionListeners) listener();
  }

  subscribeSession(listener: () => void): () => void {
    this.#sessionListeners.add(listener);
    return () => this.#sessionListeners.delete(listener);
  }

  /** Called by the HTTP client when refresh proves the session dead. */
  expire(): void {
    this.clearTokens();
    this.setSession(null);
    for (const listener of this.#expiredListeners) listener();
  }

  subscribeExpired(listener: () => void): () => void {
    this.#expiredListeners.add(listener);
    return () => this.#expiredListeners.delete(listener);
  }
}
