/**
 * Admin feature routes.
 *
 * Password-protected admin endpoints. Provides user list, room list, active stats,
 * load-performance telemetry, and request-traffic queries.
 * Auth uses X-Admin-Token header + timing-safe compare.
 * Bypasses the JWT auth system entirely.
 *
 * @throws 401 — X-Admin-Token missing or mismatched
 * @throws 400 — invalid query parameters
 * @throws 502 — Cloudflare analytics provider failed or returned an invalid response
 */

import { count, desc, eq, inArray } from 'drizzle-orm';
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import { HTTPException } from 'hono/http-exception';

import { createDb } from '../../db';
import type { AppEnv, Env } from '../../env';
import { jsonBody } from '../../platform/http/jsonBody';
import { createLogger } from '../../platform/observability/logger';
import { roomParticipants, rooms } from '../../platform/room/dbSchema';
import {
  automaticSupplyUpdateSchema,
  isWordSupplyAvailable,
  readAutomaticWordSupply,
  writeAutomaticWordSupply,
} from '../../platform/wordSupply/automaticSupply';
import { users, userStats } from '../account/dbSchema';
import { createAIUsageAnalyticsQuery, createLoadTimingAnalyticsQuery } from './analyticsQueries';
import { effectRecoveryRoutes } from './effectRecovery';
import {
  gameWordGameSchema,
  getGameWordsStats,
  triggerGameWordSupply,
  triggerSupplySchema,
} from './gameWords';
import { queryGrowthStats } from './growthStats';
import { maintenanceUpdateSchema, readMaintenance, writeMaintenance } from './maintenance';
import {
  queryAIUsageAnalytics,
  queryLoadTimingAnalytics,
  queryRealtimeTrafficAnalytics,
  queryRequestTrafficAnalytics,
} from './providers/analyticsEngine';
import { queryD1UsageAnalytics, queryWorkerInvocationAnalytics } from './providers/workerAnalytics';
import {
  createAdminRequestTrafficSummary,
  createRequestTrafficQueryPlan,
  REQUEST_TRAFFIC_MAX_RANGE_MS,
} from './requestTrafficSummary';
import { rewardGrantRoutes } from './rewardGrants';
import { queryUserCountries, queryUserDirectory } from './userDirectory';

const log = createLogger('admin');

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
/** Admin portal routes (admin permission required). */ export const adminRoutes =
  new Hono<AppEnv>();

adminRoutes.use('*', requireAdmin);
adminRoutes.route('/effect-replays', effectRecoveryRoutes);
adminRoutes.route('/users', rewardGrantRoutes);
adminRoutes.get('/session', (c) => c.body(null, 204));
adminRoutes.get('/d1-usage', async (c) => c.json(await queryD1UsageAnalytics(c.env)));

// These endpoints must remain usable while D1 is unavailable.
adminRoutes.get('/maintenance', async (c) => {
  c.header('Cache-Control', 'no-store');
  return c.json(await readMaintenance(c.env));
});
adminRoutes.post('/maintenance', jsonBody(maintenanceUpdateSchema), async (c) => {
  const configuration = c.req.valid('json');
  await writeMaintenance(c.env, configuration);
  log.info('site maintenance updated', { enabled: configuration.enabled });
  c.header('Cache-Control', 'no-store');
  return c.json(configuration);
});

// ── GET /admin/users ────────────────────────────────────────────────────────

adminRoutes.get('/users', async (c) => {
  return c.json(await queryUserDirectory(c.env.DB, c.req.query()));
});
adminRoutes.get('/users/countries', async (c) => c.json(await queryUserCountries(c.env.DB)));

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
      gameType: rooms.gameType,
      status: rooms.status,
      reconciliationAttemptCount: rooms.reconciliationAttemptCount,
      reconcileAfter: rooms.reconcileAfter,
      lastError: rooms.lastError,
      hostUserId: rooms.hostUserId,
      createdAt: rooms.createdAt,
      hostName: users.displayName,
      hostCountry: users.lastCountry,
      gamesStarted: rooms.gamesStarted,
      lastStartedAt: rooms.lastStartedAt,
      participantCount: count(roomParticipants.userId),
    })
    .from(rooms)
    .leftJoin(users, eq(rooms.hostUserId, users.id))
    .leftJoin(roomParticipants, eq(rooms.id, roomParticipants.roomId))
    .groupBy(rooms.id)
    .orderBy(desc(rooms.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    rooms: rows.map((r) => ({
      id: r.id,
      code: r.code,
      gameType: r.gameType,
      status: r.status,
      reconciliationAttemptCount: r.reconciliationAttemptCount,
      reconcileAfter: r.reconcileAfter,
      lastError: r.lastError,
      hostUserId: r.hostUserId,
      hostName: r.hostName,
      hostCountry: r.hostCountry,
      gamesStarted: r.gamesStarted,
      lastStartedAt: r.lastStartedAt,
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
    .innerJoin(rooms, eq(roomParticipants.roomId, rooms.id))
    .innerJoin(users, eq(roomParticipants.userId, users.id))
    .leftJoin(userStats, eq(roomParticipants.userId, userStats.userId))
    .where(eq(rooms.code, roomCode))
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
  const from = c.req.query('from');
  const to = c.req.query('to');
  if (!from || !to) {
    throw new HTTPException(400, { message: 'MISSING_TIME_RANGE' });
  }

  if (!Number.isFinite(Date.parse(from)) || !Number.isFinite(Date.parse(to)) || from >= to) {
    throw new HTTPException(400, { message: 'INVALID_TIME_RANGE' });
  }
  return c.json(await queryGrowthStats(c.env.DB, from, to));
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

  const rows = await queryLoadTimingAnalytics(
    c.env,
    createLoadTimingAnalyticsQuery(fromDate, toDate),
  );

  // Aggregate by country
  const countryMap = new Map<string, { count: number; totalLoadMs: number; totalTtfbMs: number }>();
  const coloMap = new Map<string, number>();
  const ispMap = new Map<string, number>();

  let totalCount = 0;
  let totalLoadMs = 0;
  let totalTtfbMs = 0;

  for (const row of rows) {
    const cnt = row.cnt;
    const avgLoad = row.avg_load_ms;
    const avgTtfb = row.avg_ttfb_ms;

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

// ── GET /admin/request-traffic ──────────────────────────────────────────────

adminRoutes.get('/request-traffic', async (c) => {
  const from = c.req.query('from');
  const to = c.req.query('to');
  if (!from || !to) {
    throw new HTTPException(400, { message: 'MISSING_TIME_RANGE' });
  }

  const fromDate = new Date(from);
  const toDate = new Date(to);
  const durationMs = toDate.getTime() - fromDate.getTime();
  if (
    Number.isNaN(fromDate.getTime()) ||
    Number.isNaN(toDate.getTime()) ||
    durationMs <= 0 ||
    durationMs > REQUEST_TRAFFIC_MAX_RANGE_MS
  ) {
    throw new HTTPException(400, { message: 'INVALID_TIME_RANGE' });
  }

  const queryPlan = createRequestTrafficQueryPlan(fromDate, toDate);
  const [platform, httpRows, realtimeRows] = await Promise.all([
    queryWorkerInvocationAnalytics(c.env, fromDate.toISOString(), toDate.toISOString()),
    queryRequestTrafficAnalytics(c.env, queryPlan.httpSql),
    queryRealtimeTrafficAnalytics(c.env, queryPlan.realtimeSql),
  ]);

  return c.json(
    createAdminRequestTrafficSummary(
      platform,
      httpRows,
      realtimeRows,
      { fromDate, toDate, bucketSeconds: queryPlan.bucketSeconds },
      new Date().toISOString(),
    ),
  );
});

// ── GET /admin/ai-usage ─────────────────────────────────────────────────────

adminRoutes.get('/ai-usage', async (c) => {
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

  // blob1=userId, blob2=model, blob3=provider, blob4=country, blob5=status
  // double1=ttfrMs
  const rows = await queryAIUsageAnalytics(c.env, createAIUsageAnalyticsQuery(fromDate, toDate));

  // Aggregate into dimensions
  let totalRequests = 0;
  let totalErrors = 0;
  let totalTtfrMs = 0;
  const providerMap = new Map<string, number>();
  const modelMap = new Map<string, number>();
  const countryMap = new Map<string, number>();
  const statusMap = new Map<string, number>();
  const userMap = new Map<string, number>();

  for (const row of rows) {
    const cnt = row.cnt;
    totalRequests += cnt;
    totalTtfrMs += row.avgTtfrMs * cnt;
    if (row.status === 'error') totalErrors += cnt;

    providerMap.set(row.provider, (providerMap.get(row.provider) ?? 0) + cnt);
    modelMap.set(row.model, (modelMap.get(row.model) ?? 0) + cnt);
    countryMap.set(row.country, (countryMap.get(row.country) ?? 0) + cnt);
    statusMap.set(row.status, (statusMap.get(row.status) ?? 0) + cnt);
    userMap.set(row.userId, (userMap.get(row.userId) ?? 0) + cnt);
  }

  const avgTtfrMs = totalRequests > 0 ? Math.round(totalTtfrMs / totalRequests) : 0;
  const errorRate = totalRequests > 0 ? totalErrors / totalRequests : 0;

  // Top users — resolve displayName from D1
  const topUserEntries = [...userMap.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  const topUserIds = topUserEntries.map(([id]) => id);

  let displayNameMap = new Map<string, string | null>();
  if (topUserIds.length > 0) {
    const db = createDb(c.env.DB);
    const nameRows = await db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(inArray(users.id, topUserIds));
    displayNameMap = new Map(nameRows.map((r) => [r.id, r.displayName]));
  }

  const toSorted = (map: Map<string, number>) =>
    [...map.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count);

  return c.json({
    totalRequests,
    avgTtfrMs,
    errorRate: Math.round(errorRate * 10000) / 100, // percent, 2 decimals
    providers: toSorted(providerMap),
    models: toSorted(modelMap),
    countries: toSorted(countryMap),
    statuses: toSorted(statusMap),
    topUsers: topUserEntries.map(([userId, count]) => ({
      userId,
      displayName: displayNameMap.get(userId) ?? null,
      count,
    })),
  });
});

adminRoutes.get('/games/words/stats', async (c) => {
  const parsed = gameWordGameSchema.safeParse(c.req.query('game'));
  if (!parsed.success) throw new HTTPException(400, { message: 'INVALID_GAME' });
  return c.json(await getGameWordsStats(c.env, parsed.data));
});

adminRoutes.get('/games/words/automatic-supply', async (c) => {
  const parsed = gameWordGameSchema.safeParse(c.req.query('game'));
  if (!parsed.success) throw new HTTPException(400, { message: 'INVALID_GAME' });
  c.header('Cache-Control', 'no-store');
  return c.json({
    game: parsed.data,
    available: isWordSupplyAvailable(c.env, parsed.data),
    ...(await readAutomaticWordSupply(c.env, parsed.data)),
  });
});

adminRoutes.post(
  '/games/words/automatic-supply',
  jsonBody(automaticSupplyUpdateSchema),
  async (c) => {
    const { game, enabled } = c.req.valid('json');
    await writeAutomaticWordSupply(c.env, game, enabled);
    log.info('automatic word supply updated', { game, enabled });
    c.header('Cache-Control', 'no-store');
    return c.json({ game, enabled, available: isWordSupplyAvailable(c.env, game) });
  },
);

adminRoutes.post('/games/words/trigger-supply', jsonBody(triggerSupplySchema), async (c) => {
  const { game, force } = c.req.valid('json');
  return c.json(await triggerGameWordSupply(c.env, { game, force }), 202);
});
