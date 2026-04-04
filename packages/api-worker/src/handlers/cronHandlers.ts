/**
 * Cron Handlers — 定时清理任务
 *
 * 由 Cloudflare Cron Trigger 每日 UTC 03:00 触发。
 * - 删除 24 小时前创建的过期房间
 * - 清理 14 天不活跃的匿名用户（需非任何房间 host）
 */

import type { Env } from '../env';

const ROOM_MAX_AGE_HOURS = 24;
const ANON_INACTIVE_DAYS = 14;
const BATCH_LIMIT = 1000;

async function cleanupStaleRooms(env: Env): Promise<{ deleted: number }> {
  const result = await env.DB.prepare(
    `DELETE FROM rooms WHERE created_at < datetime('now', ? || ' hours')`,
  )
    .bind(`-${ROOM_MAX_AGE_HOURS}`)
    .run();

  const deleted = result.meta.changes ?? 0;
  console.log(`[cron] cleanupStaleRooms: deleted ${deleted} rows`);
  return { deleted };
}

async function cleanupAnonymousUsers(env: Env): Promise<{ deleted: number }> {
  const result = await env.DB.prepare(
    `DELETE FROM users
     WHERE id IN (
       SELECT u.id FROM users u
       LEFT JOIN rooms r ON r.host_id = u.id
       WHERE u.is_anonymous = 1
         AND u.updated_at < datetime('now', ? || ' days')
         AND r.id IS NULL
       LIMIT ?
     )`,
  )
    .bind(`-${ANON_INACTIVE_DAYS}`, BATCH_LIMIT)
    .run();

  const deleted = result.meta.changes ?? 0;
  console.log(`[cron] cleanupAnonymousUsers: deleted ${deleted} rows`);
  return { deleted };
}

/** Run all scheduled cleanup tasks. */
export async function runScheduledCleanup(env: Env): Promise<void> {
  const rooms = await cleanupStaleRooms(env);
  const users = await cleanupAnonymousUsers(env);
  console.log(
    `[cron] cleanup complete — rooms: ${rooms.deleted}, anonymousUsers: ${users.deleted}`,
  );
}
