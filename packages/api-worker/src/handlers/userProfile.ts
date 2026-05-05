/**
 * userProfile — 用户 profile 查询与序列化的单一真相
 *
 * 所有 auth 端点返回 user_metadata 时必须通过此模块。
 * 新增装饰字段只需改此文件 + DB schema，不需要改 7 个 handler 位置。
 */

import { eq } from 'drizzle-orm';

import type { createDb } from '../db';
import { users } from '../db/schema';

// ── Wire format (API → 客户端) ─────────────────────────────────────────────

/** API 返回给客户端的 user_metadata 完整类型（snake_case wire format） */
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

// ── DB select 字段（单一真相） ──────────────────────────────────────────────

/**
 * 从 users 表选取 profile 相关列。
 * 所有 auth 端点共用，避免字段遗漏。
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

/** DB 查询结果行的类型 */
type ProfileRow = {
  [K in keyof typeof PROFILE_SELECT]: string | null;
};

// ── 序列化 ──────────────────────────────────────────────────────────────────

/** 将 DB profile row 转为 wire format user_metadata */
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

// ── DB 查询 ─────────────────────────────────────────────────────────────────

/**
 * 查询用户 profile 列（不含 id/email/isAnonymous 等身份字段）。
 * 返回 null 表示用户不存在。
 */
export async function selectUserProfile(
  db: ReturnType<typeof createDb>,
  userId: string,
): Promise<ProfileRow | null> {
  const row = await db.select(PROFILE_SELECT).from(users).where(eq(users.id, userId)).get();
  return row ?? null;
}
