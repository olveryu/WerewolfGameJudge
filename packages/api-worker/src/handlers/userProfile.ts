/**
 * userProfile — single source of truth for user profile queries and serialization
 *
 * All auth endpoints returning user_metadata must go through this module.
 * Adding a new cosmetic field only requires editing this file + DB schema,
 * not 7 different handler sites.
 */

import { eq } from 'drizzle-orm';

import type { createDb } from '../db';
import { users } from '../db/schema';

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
export function toUserMetadata(row: ProfileRow | null | undefined): UserMetadata {
  return {
    display_name: row?.displayName ?? null,
    avatar_url: row?.avatarUrl ?? null,
    custom_avatar_url: row?.customAvatarUrl ?? null,
    avatar_frame: row?.avatarFrame ?? null,
    seat_flair: row?.equippedFlair ?? null,
    name_style: row?.equippedNameStyle ?? null,
    equipped_effect: row?.equippedEffect ?? null,
    seat_animation: row?.equippedSeatAnimation ?? null,
  };
}

// ── DB queries ──────────────────────────────────────────────────────────────

/**
 * Queries user profile columns (excludes identity fields like id/email/isAnonymous).
 * Returns null if the user does not exist.
 */
export async function selectUserProfile(
  db: ReturnType<typeof createDb>,
  userId: string,
): Promise<ProfileRow | null> {
  const row = await db.select(PROFILE_SELECT).from(users).where(eq(users.id, userId)).get();
  return row ?? null;
}
