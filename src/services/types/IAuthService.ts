/**
 * IAuthService - Authentication service interface
 *
 * Defines the public API contract for auth service, covering anonymous login, email auth, user profile management.
 * Does not involve game logic or game state storage.
 */

/**
 * Full user_metadata type returned by API (snake_case wire format).
 * Kept in sync with UserMetadata in server-side userProfile.ts.
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
 * Abstract user type.
 * Only includes fields actually read by business code.
 */
export interface AuthUser {
  id: string;
  email?: string | null;
  is_anonymous?: boolean;
  has_wechat?: boolean;
  user_metadata?: UserMetadata;
}

/**
 * Return value of getCurrentUser().
 *
 * Contract: server `/auth/user` returns this structure only on 200; missing user / invalid token -> 401/404,
 * thrown by cfFetch, won't reach here. So `user` is never null.
 */
export interface GetCurrentUserResponse {
  data: { user: AuthUser };
}

/** Auth service interface - covers anonymous login, email auth, user profile management. */
export interface IAuthService {
  /** Wait for initialization to complete (session restore / auto login) */
  waitForInit(): Promise<void>;

  /** Whether the mini-program requires user to manually trigger WeChat login (only meaningful inside miniprogram web-view) */
  readonly needsWechatLogin: boolean;

  /**
   * Ensure authenticated: prefer session restore, fallback to anonymous login.
   * Throws on network failure.
   */
  ensureAuthenticated(): Promise<string>;

  /** Whether the service is configured (env vars complete + client initialized) */
  isConfigured(): boolean;

  /** Current user ID (synchronous read of cached value) */
  getCurrentUserId(): string | null;

  /**
   * Get current user full info.
   * Returns null when not logged in or token invalid.
   */
  getCurrentUser(): Promise<GetCurrentUserResponse | null>;

  /** Anonymous login, returns userId */
  signInAnonymously(): Promise<string>;

  /** Email signup (upgrade anonymous user or create new account) */
  signUpWithEmail(
    email: string,
    password: string,
    displayName?: string,
  ): Promise<{ userId: string; user: AuthUser | null }>;

  /** Email + password login, returns userId */
  signInWithEmail(email: string, password: string): Promise<string>;

  /** Update user profile (display name / avatar / avatar frame / seat flair / name style / reveal effect / seat animation) */
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

  /** Sign out */
  signOut(): Promise<void>;

  /** Change password (logged-in email user) */
  changePassword(oldPassword: string, newPassword: string): Promise<void>;

  /** Send password reset verification code email */
  forgotPassword(email: string): Promise<void>;

  /** Reset password with verification code, auto login on success, returns userId */
  resetPassword(email: string, code: string, newPassword: string): Promise<string>;

  /** Restore auth from local session, returns userId or null */
  initAuth(): Promise<string | null>;

  /** Generate random Chinese display name (Werewolf meme prefix + role name), cached per session */
  generateDisplayName(): string;
}
