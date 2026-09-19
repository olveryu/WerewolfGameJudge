/**
 * Admin-only ticket grants and their immutable audit history.
 * Mounted under authenticated /admin/users; never accepts a balance replacement.
 * @remarks A unique claim and additive stats update commit in one D1 batch.
 * @throws 400 Invalid grant, 404 missing user, 409 reused ID with different contents.
 */
import { getTableName } from 'drizzle-orm';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

import type { AppEnv } from '../../env';
import { jsonBody } from '../../platform/http/jsonBody';
import { adminRewardGrants } from './dbSchema';

const GRANTS_TABLE = getTableName(adminRewardGrants);
const MAX_GRANT_COUNT = 10000;
const HISTORY_LIMIT = 20;
const grantSchema = z.strictObject({
  id: z.uuid(),
  drawType: z.enum(['normal', 'golden']),
  count: z.number().int().min(1).max(MAX_GRANT_COUNT),
  reason: z.string().trim().min(1).max(200),
});

const grantRecordSchema = grantSchema.extend({
  userId: z.string().min(1),
  balanceBefore: z.number().int().nonnegative(),
  balanceAfter: z.number().int().nonnegative(),
  createdAt: z.string(),
});

const GRANT_COLUMNS = `id, user_id AS userId, draw_type AS drawType, count, reason,
  balance_before AS balanceBefore, balance_after AS balanceAfter, created_at AS createdAt`;

/** Admin reward read/write routes; authentication belongs to the parent router. */
export const rewardGrantRoutes = new Hono<AppEnv>();

rewardGrantRoutes.get('/:userId/rewards', async (context) => {
  const userId = context.req.param('userId');
  const balances = await context.env.DB.prepare(
    `SELECT COALESCE(s.normal_draws, 0) AS normalDraws,
            COALESCE(s.golden_draws, 0) AS goldenDraws
     FROM users u LEFT JOIN user_stats s ON s.user_id = u.id WHERE u.id = ?1`,
  )
    .bind(userId)
    .first();
  if (balances === null) throw new HTTPException(404, { message: 'USER_NOT_FOUND' });
  const history = await context.env.DB.prepare(
    `SELECT ${GRANT_COLUMNS} FROM ${GRANTS_TABLE}
     WHERE user_id = ?1 ORDER BY created_at DESC, id DESC LIMIT ?2`,
  )
    .bind(userId, HISTORY_LIMIT)
    .all();
  return context.json({
    ...z
      .strictObject({
        normalDraws: z.number().int().nonnegative(),
        goldenDraws: z.number().int().nonnegative(),
      })
      .parse(balances),
    grants: grantRecordSchema.array().parse(history.results),
  });
});

rewardGrantRoutes.post('/:userId/rewards', jsonBody(grantSchema), async (context) => {
  const userId = context.req.param('userId');
  const input = context.req.valid('json');
  const claimId = crypto.randomUUID();
  const balanceColumn = input.drawType === 'golden' ? 'golden_draws' : 'normal_draws';
  const database = context.env.DB;
  const results = await database.batch([
    database
      .prepare(
        `INSERT INTO ${GRANTS_TABLE}
        (id, user_id, claim_id, draw_type, count, reason, balance_before, balance_after, created_at)
       SELECT ?1, u.id, ?2, ?3, ?4, ?5, COALESCE(s.${balanceColumn}, 0),
              COALESCE(s.${balanceColumn}, 0) + ?4, ?6
       FROM users u LEFT JOIN user_stats s ON s.user_id = u.id WHERE u.id = ?7
       ON CONFLICT(id) DO NOTHING`,
      )
      .bind(
        input.id,
        claimId,
        input.drawType,
        input.count,
        input.reason,
        new Date().toISOString(),
        userId,
      ),
    database
      .prepare(
        `INSERT INTO user_stats (user_id, ${balanceColumn}, version, updated_at)
      SELECT user_id, count, 1, created_at FROM ${GRANTS_TABLE}
       WHERE id = ?1 AND claim_id = ?2
       ON CONFLICT(user_id) DO UPDATE SET
         ${balanceColumn} = user_stats.${balanceColumn} + excluded.${balanceColumn},
         version = user_stats.version + 1, updated_at = excluded.updated_at`,
      )
      .bind(input.id, claimId),
    database.prepare(`SELECT ${GRANT_COLUMNS} FROM ${GRANTS_TABLE} WHERE id = ?1`).bind(input.id),
  ]);
  const record = results[2].results[0];
  if (record === undefined) throw new HTTPException(404, { message: 'USER_NOT_FOUND' });
  const grant = grantRecordSchema.parse(record);
  if (
    grant.userId !== userId ||
    grant.drawType !== input.drawType ||
    grant.count !== input.count ||
    grant.reason !== input.reason
  ) {
    throw new HTTPException(409, { message: 'REWARD_GRANT_CONFLICT' });
  }
  return context.json(grant);
});
