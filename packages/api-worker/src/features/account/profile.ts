/**
 * Account profile query and serialization contract.
 *
 * All account and auth endpoints returning user_metadata must go through this module.
 * Adding a new cosmetic field only requires editing this file + DB schema,
 * not 7 different handler sites.
 */

import { eq } from 'drizzle-orm';

import type { createDb } from '../../db';
import { users } from './dbSchema';

// ── Wire format (API -> client) ─────────────────────────────────────────────

/** Full user_metadata type returned to clients (snake_case wire format) */
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

/** Canonical user identity returned by every successful auth endpoint. */
export interface AuthUserResponse {
  readonly id: string;
  readonly email: string | null;
  readonly is_anonymous: boolean;
  readonly has_wechat: boolean;
  readonly user_metadata: UserMetadata;
}

// ── DB select fields (single source of truth) ──────────────────────────────

/**
 * Selects profile-related columns from the users table.
 * Shared across all auth endpoints to avoid missing fields.
 */
const PROFILE_SELECT = {
  displayName: users.displayName,
  avatarUrl: users.avatarUrl,
  customAvatarUrl: users.customAvatarUrl,
  avatarFrame: users.avatarFrame,
  equippedFlair: users.equippedFlair,
  equippedNameStyle: users.equippedNameStyle,
  equippedEffect: users.equippedEffect,
  equippedSeatAnimation: users.equippedSeatAnimation,
} as const;

const AUTH_USER_SELECT = {
  id: users.id,
  email: users.email,
  isAnonymous: users.isAnonymous,
  wechatOpenid: users.wechatOpenid,
  ...PROFILE_SELECT,
} as const;

/** DB query result row type */
type ProfileRow = {
  [K in keyof typeof PROFILE_SELECT]: string | null;
};

type AuthUserRow = {
  readonly id: string;
  readonly email: string | null;
  readonly isAnonymous: number;
  readonly wechatOpenid: string | null;
} & ProfileRow;

// ── Serialization ───────────────────────────────────────────────────────────

/** Converts a DB profile row to wire-format user_metadata */
function toUserMetadata(row: ProfileRow): UserMetadata {
  return {
    display_name: row.displayName,
    avatar_url: row.avatarUrl,
    custom_avatar_url: row.customAvatarUrl,
    avatar_frame: row.avatarFrame,
    seat_flair: row.equippedFlair,
    name_style: row.equippedNameStyle,
    equipped_effect: row.equippedEffect,
    seat_animation: row.equippedSeatAnimation,
  };
}

/** Creates metadata for a user row that has just been inserted with default profile fields. */
export function createEmptyUserMetadata(): UserMetadata {
  return {
    display_name: null,
    avatar_url: null,
    custom_avatar_url: null,
    avatar_frame: null,
    seat_flair: null,
    name_style: null,
    equipped_effect: null,
    seat_animation: null,
  };
}

/** Serialize one complete account row into the canonical auth wire shape. */
function toAuthUserResponse(row: AuthUserRow): AuthUserResponse {
  if (row.isAnonymous !== 0 && row.isAnonymous !== 1) {
    throw new Error(`[FAIL-FAST] users.is_anonymous must be 0 or 1 for ${row.id}`);
  }
  return {
    id: row.id,
    email: row.email,
    is_anonymous: row.isAnonymous === 1,
    has_wechat: row.wechatOpenid !== null,
    user_metadata: toUserMetadata(row),
  };
}

// ── DB queries ──────────────────────────────────────────────────────────────

/** Read and serialize the complete auth user or fail when the authoritative row disappeared. */
export async function selectAuthUserResponse(
  db: ReturnType<typeof createDb>,
  userId: string,
): Promise<AuthUserResponse> {
  const row = await db.select(AUTH_USER_SELECT).from(users).where(eq(users.id, userId)).get();
  if (row === undefined) throw new Error(`Expected auth user ${userId}`);
  return toAuthUserResponse(row);
}
