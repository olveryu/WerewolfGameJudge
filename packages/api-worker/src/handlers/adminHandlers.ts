/**
 * handlers/adminHandlers — Admin portal Hono routes
 *
 * 密码保护的管理端点。提供用户列表、房间列表、活跃统计、加载性能遥测查询。
 * 鉴权通过 X-Admin-Token header + timing-safe compare。
 * 不走 JWT auth 体系，完全独立。
 */

import { and, count, desc, eq, like, sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

import { createDb } from '../db';
import { roomParticipants, rooms, users, userStats } from '../db/schema';
import type { AppEnv, Env } from '../env';
import { createLogger } from '../lib/logger';

const log = createLogger('admin');

const CF_ACCOUNT_ID = 'a38318fda66da2d2d931d8ab2d98e1c0';

// ── Admin auth middleware ────────────────────────────────────────────────────

/**
 * Timing-safe string comparison to prevent timing attacks.
 * Uses byte-by-byte XOR accumulation — constant time regardless of match position.
 */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const encoder = new TextEncoder();
  const bufA = encoder.encode(a);
  const bufB = encoder.encode(b);
  let diff = 0;
  for (let i = 0; i < bufA.length; i++) {
    diff |= bufA[i] ^ bufB[i];
  }
  return diff === 0;
}

const requireAdmin = createMiddleware<{ Bindings: Env }>(async (c, next) => {
  const token = c.req.header('X-Admin-Token');
  if (!token) {
    throw new HTTPException(401, { message: 'ADMIN_TOKEN_REQUIRED' });
  }
  if (!timingSafeEqual(token, c.env.ADMIN_PASSWORD)) {
    log.warn('admin auth failed');
    throw new HTTPException(403, { message: 'INVALID_ADMIN_TOKEN' });
  }
  await next();
});

// ── Routes ──────────────────────────────────────────────────────────────────

export const adminRoutes = new Hono<AppEnv>();

adminRoutes.use('*', requireAdmin);

// ── GET /admin/users ────────────────────────────────────────────────────────

adminRoutes.get('/users', async (c) => {
  const db = createDb(c.env.DB);

  const page = Math.max(1, Number(c.req.query('page') || '1'));
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') || '50')));
  const offset = (page - 1) * limit;

  const sortField = c.req.query('sort') || 'created_at';
  const order = c.req.query('order') === 'asc' ? 'asc' : 'desc';
  const country = c.req.query('country');
  const type = c.req.query('type'); // 'registered' | 'anonymous'
  const search = c.req.query('search');

  // Build WHERE conditions
  const conditions = [];
  if (country) {
    conditions.push(eq(users.lastCountry, country));
  }
  if (type === 'registered') {
    conditions.push(eq(users.isAnonymous, 0));
  } else if (type === 'anonymous') {
    conditions.push(eq(users.isAnonymous, 1));
  }
  if (search) {
    conditions.push(like(users.displayName, `%${search}%`));
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

  // Count total
  const [totalRow] = await db.select({ count: count() }).from(users).where(whereClause);
  const total = totalRow.count;

  // Query with join — use raw SQL for flexible ORDER BY
  const orderDir = order === 'asc' ? sql`ASC` : sql`DESC`;
  const orderColumn =
    sortField === 'level'
      ? sql`COALESCE(user_stats.level, 0)`
      : sortField === 'games_played'
        ? sql`COALESCE(user_stats.games_played, 0)`
        : sortField === 'updated_at'
          ? sql`users.updated_at`
          : sql`users.created_at`;

  const rows = await db
    .select({
      id: users.id,
      displayName: users.displayName,
      email: users.email,
      isAnonymous: users.isAnonymous,
      lastCountry: users.lastCountry,
      lastColo: users.lastColo,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      level: userStats.level,
      xp: userStats.xp,
      gamesPlayed: userStats.gamesPlayed,
    })
    .from(users)
    .leftJoin(userStats, eq(users.id, userStats.userId))
    .where(whereClause)
    .orderBy(sql`${orderColumn} ${orderDir}`)
    .limit(limit)
    .offset(offset);

  return c.json({
    users: rows.map((r) => ({
      id: r.id,
      displayName: r.displayName,
      email: r.email,
      isAnonymous: r.isAnonymous === 1,
      lastCountry: r.lastCountry,
      lastColo: r.lastColo,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
      level: r.level ?? 0,
      xp: r.xp ?? 0,
      gamesPlayed: r.gamesPlayed ?? 0,
    })),
    total,
    page,
    limit,
  });
});

// ── GET /admin/rooms ────────────────────────────────────────────────────────

adminRoutes.get('/rooms', async (c) => {
  const db = createDb(c.env.DB);

  const page = Math.max(1, Number(c.req.query('page') || '1'));
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') || '50')));
  const offset = (page - 1) * limit;

  const [totalRow] = await db.select({ count: count() }).from(rooms);
  const total = totalRow.count;

  const rows = await db
    .select({
      id: rooms.id,
      code: rooms.code,
      hostUserId: rooms.hostUserId,
      createdAt: rooms.createdAt,
      hostName: users.displayName,
      hostCountry: users.lastCountry,
      participantCount: count(roomParticipants.userId),
    })
    .from(rooms)
    .leftJoin(users, eq(rooms.hostUserId, users.id))
    .leftJoin(roomParticipants, eq(rooms.code, roomParticipants.roomCode))
    .groupBy(rooms.id)
    .orderBy(desc(rooms.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    rooms: rows.map((r) => ({
      id: r.id,
      code: r.code,
      hostUserId: r.hostUserId,
      hostName: r.hostName,
      hostCountry: r.hostCountry,
      participantCount: r.participantCount,
      createdAt: r.createdAt,
    })),
    total,
    page,
    limit,
  });
});

// ── GET /admin/rooms/:roomCode/players ──────────────────────────────────────

adminRoutes.get('/rooms/:roomCode/players', async (c) => {
  const db = createDb(c.env.DB);
  const roomCode = c.req.param('roomCode');

  const rows = await db
    .select({
      userId: roomParticipants.userId,
      joinedAt: roomParticipants.joinedAt,
      displayName: users.displayName,
      lastCountry: users.lastCountry,
      lastColo: users.lastColo,
      createdAt: users.createdAt,
      level: userStats.level,
      xp: userStats.xp,
      gamesPlayed: userStats.gamesPlayed,
    })
    .from(roomParticipants)
    .innerJoin(users, eq(roomParticipants.userId, users.id))
    .leftJoin(userStats, eq(roomParticipants.userId, userStats.userId))
    .where(eq(roomParticipants.roomCode, roomCode))
    .orderBy(roomParticipants.joinedAt);

  return c.json({
    players: rows.map((r) => ({
      userId: r.userId,
      displayName: r.displayName,
      lastCountry: r.lastCountry,
      lastColo: r.lastColo,
      createdAt: r.createdAt,
      joinedAt: r.joinedAt,
      level: r.level ?? 0,
      xp: r.xp ?? 0,
      gamesPlayed: r.gamesPlayed ?? 0,
    })),
  });
});

// ── GET /admin/stats ────────────────────────────────────────────────────────

adminRoutes.get('/stats', async (c) => {
  const db = createDb(c.env.DB);

  const from = c.req.query('from');
  const to = c.req.query('to');
  if (!from || !to) {
    throw new HTTPException(400, { message: 'MISSING_TIME_RANGE' });
  }

  // New registrations in range
  const [regRow] = await db
    .select({ count: count() })
    .from(users)
    .where(and(sql`${users.createdAt} >= ${from}`, sql`${users.createdAt} < ${to}`));

  // Active users (updated_at in range)
  const [activeRow] = await db
    .select({ count: count() })
    .from(users)
    .where(and(sql`${users.updatedAt} >= ${from}`, sql`${users.updatedAt} < ${to}`));

  // Total games played in range (sum of games for users active in range)
  const [gamesRow] = await db
    .select({ total: sql<number>`COALESCE(SUM(${userStats.gamesPlayed}), 0)` })
    .from(userStats)
    .innerJoin(users, eq(userStats.userId, users.id))
    .where(and(sql`${users.updatedAt} >= ${from}`, sql`${users.updatedAt} < ${to}`));

  // Country distribution (active in range)
  const countries = await db
    .select({
      country: users.lastCountry,
      count: count(),
    })
    .from(users)
    .where(
      and(
        sql`${users.updatedAt} >= ${from}`,
        sql`${users.updatedAt} < ${to}`,
        sql`${users.lastCountry} IS NOT NULL`,
      ),
    )
    .groupBy(users.lastCountry)
    .orderBy(desc(count()));

  // Colo distribution (active in range)
  const colos = await db
    .select({
      colo: users.lastColo,
      count: count(),
    })
    .from(users)
    .where(
      and(
        sql`${users.updatedAt} >= ${from}`,
        sql`${users.updatedAt} < ${to}`,
        sql`${users.lastColo} IS NOT NULL`,
      ),
    )
    .groupBy(users.lastColo)
    .orderBy(desc(count()));

  return c.json({
    registered: regRow.count,
    active: activeRow.count,
    totalGames: gamesRow.total,
    countries: countries.map((r) => ({ country: r.country ?? '', count: r.count })),
    colos: colos.map((r) => ({ colo: r.colo ?? '', count: r.count })),
  });
});

// ── GET /admin/analytics ────────────────────────────────────────────────────

adminRoutes.get('/analytics', async (c) => {
  const from = c.req.query('from');
  const to = c.req.query('to');
  if (!from || !to) {
    throw new HTTPException(400, { message: 'MISSING_TIME_RANGE' });
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);
  if (Number.isNaN(fromDate.getTime()) || Number.isNaN(toDate.getTime())) {
    throw new HTTPException(400, { message: 'INVALID_TIME_RANGE' });
  }

  const apiToken = c.env.CF_API_TOKEN;
  if (!apiToken) {
    throw new HTTPException(503, { message: 'CF_API_TOKEN_NOT_CONFIGURED' });
  }

  // Analytics Engine toDateTime() accepts 'YYYY-MM-DDTHH:MM:SS' only (no Z, no ms)
  const aeFrom = fromDate.toISOString().slice(0, 19);
  const aeTo = toDate.toISOString().slice(0, 19);

  const sqlQuery = `
    SELECT
      blob3 as country,
      blob4 as colo,
      blob5 as isp,
      count() as cnt,
      avg(double1) as avg_load_ms,
      avg(double7) as avg_ttfb_ms
    FROM load_timing
    WHERE timestamp >= toDateTime('${aeFrom}') AND timestamp < toDateTime('${aeTo}')
    GROUP BY country, colo, isp
    ORDER BY cnt DESC
  `;

  const resp = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/analytics_engine/sql`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'text/plain',
      },
      body: sqlQuery,
    },
  );

  if (!resp.ok) {
    const text = await resp.text();
    log.error('Analytics Engine query failed', { status: resp.status, body: text });
    throw new HTTPException(502, { message: 'ANALYTICS_QUERY_FAILED' });
  }

  const data: { data: AnalyticsRow[] } = await resp.json();
  const rows = data.data ?? [];

  // Aggregate by country
  const countryMap = new Map<string, { count: number; totalLoadMs: number; totalTtfbMs: number }>();
  const coloMap = new Map<string, number>();
  const ispMap = new Map<string, number>();

  let totalCount = 0;
  let totalLoadMs = 0;
  let totalTtfbMs = 0;

  for (const row of rows) {
    const cnt = Number(row.cnt);
    const avgLoad = Number(row.avg_load_ms);
    const avgTtfb = Number(row.avg_ttfb_ms);

    totalCount += cnt;
    totalLoadMs += avgLoad * cnt;
    totalTtfbMs += avgTtfb * cnt;

    // Country aggregation
    if (row.country) {
      const existing = countryMap.get(row.country);
      if (existing) {
        existing.count += cnt;
        existing.totalLoadMs += avgLoad * cnt;
        existing.totalTtfbMs += avgTtfb * cnt;
      } else {
        countryMap.set(row.country, {
          count: cnt,
          totalLoadMs: avgLoad * cnt,
          totalTtfbMs: avgTtfb * cnt,
        });
      }
    }

    // Colo aggregation
    if (row.colo) {
      coloMap.set(row.colo, (coloMap.get(row.colo) ?? 0) + cnt);
    }

    // ISP aggregation
    if (row.isp) {
      ispMap.set(row.isp, (ispMap.get(row.isp) ?? 0) + cnt);
    }
  }

  const avgLoadMs = totalCount > 0 ? Math.round(totalLoadMs / totalCount) : 0;
  const avgTtfbMs = totalCount > 0 ? Math.round(totalTtfbMs / totalCount) : 0;

  const countries = [...countryMap.entries()]
    .map(([country, d]) => ({
      country,
      count: d.count,
      avgLoadMs: Math.round(d.totalLoadMs / d.count),
    }))
    .sort((a, b) => b.count - a.count);

  const colos = [...coloMap.entries()]
    .map(([colo, cnt]) => ({ colo, count: cnt }))
    .sort((a, b) => b.count - a.count);

  const isps = [...ispMap.entries()]
    .map(([isp, cnt]) => ({ isp, count: cnt }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return c.json({ avgLoadMs, avgTtfbMs, totalRequests: totalCount, countries, colos, isps });
});

interface AnalyticsRow {
  country: string;
  colo: string;
  isp: string;
  cnt: string;
  avg_load_ms: string;
  avg_ttfb_ms: string;
}
