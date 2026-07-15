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
interface UserMetadata {
  display_name: string | null;
  avatar_url: string | null;
  custom_avatar_url: string | null;
  avatar_frame: string | null;
  seat_flair: string | null;
  name_style: string | null;
  equipped_effect: string | null;
  seat_animation: string | null;
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

/** DB query result row type */
type ProfileRow = {
  [K in keyof typeof PROFILE_SELECT]: string | null;
};

// ── Serialization ───────────────────────────────────────────────────────────

/** Converts a DB profile row to wire-format user_metadata */
export function toUserMetadata(row: ProfileRow): UserMetadata {
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

// ── DB queries ──────────────────────────────────────────────────────────────

/**
 * Queries user profile columns (excludes identity fields like id/email/isAnonymous).
 * Throws if the required user does not exist.
 */
export async function selectUserProfile(
  db: ReturnType<typeof createDb>,
  userId: string,
): Promise<ProfileRow> {
  const row = await db.select(PROFILE_SELECT).from(users).where(eq(users.id, userId)).get();
  if (row === undefined) throw new Error(`Expected profile for user ${userId}`);
  return row;
}
