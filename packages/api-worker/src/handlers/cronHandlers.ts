/**
 * Cron Handlers — 定时清理任务
 *
 * 由 Cloudflare Cron Trigger 每日 UTC 03:00 触发。
 * - 删除 24 小时前创建的过期房间
 * - 清理 14 天不活跃的匿名用户（需非任何房间 host）
 */

import { sql } from 'drizzle-orm';

import { createDb } from '../db';
import { loginAttempts, rooms, users } from '../db/schema';
import type { Env } from '../env';

const ROOM_MAX_AGE_HOURS = 24;
const ANON_INACTIVE_DAYS = 14;
const BATCH_LIMIT = 1000;

async function cleanupStaleRooms(env: Env): Promise<{ deleted: number }> {
  const db = createDb(env.DB);
  const result = await db
    .delete(rooms)
    .where(sql`${rooms.createdAt} < datetime('now', ${`-${ROOM_MAX_AGE_HOURS}`} || ' hours')`)
    .returning({ id: rooms.id });

  const deleted = result.length;
  console.log(`[cron] cleanupStaleRooms: deleted ${deleted} rows`);
  return { deleted };
}

async function cleanupAnonymousUsers(env: Env): Promise<{ deleted: number }> {
  const db = createDb(env.DB);
  const result = await db
    .delete(users)
    .where(
      sql`${users.id} IN (
        SELECT u.id FROM users u
        LEFT JOIN rooms r ON r.host_user_id = u.id
        WHERE u.is_anonymous = 1
          AND u.updated_at < datetime('now', ${`-${ANON_INACTIVE_DAYS}`} || ' days')
          AND r.id IS NULL
        LIMIT ${BATCH_LIMIT}
      )`,
    )
    .returning({ id: users.id });

  const deleted = result.length;
  console.log(`[cron] cleanupAnonymousUsers: deleted ${deleted} rows`);
  return { deleted };
}

async function cleanupOldLoginAttempts(env: Env): Promise<{ deleted: number }> {
  const db = createDb(env.DB);
  const result = await db
    .delete(loginAttempts)
    .where(sql`${loginAttempts.attemptedAt} < datetime('now', '-1 hour')`)
    .returning({ id: loginAttempts.id });

  const deleted = result.length;
  console.log(`[cron] cleanupOldLoginAttempts: deleted ${deleted} rows`);
  return { deleted };
}

/** Run all scheduled cleanup tasks. */
export async function runScheduledCleanup(env: Env): Promise<void> {
  const rooms = await cleanupStaleRooms(env);
  const users = await cleanupAnonymousUsers(env);
  const logins = await cleanupOldLoginAttempts(env);
  console.log(
    `[cron] cleanup complete — rooms: ${rooms.deleted}, anonymousUsers: ${users.deleted}, loginAttempts: ${logins.deleted}`,
  );
}
