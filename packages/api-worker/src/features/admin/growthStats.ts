/** Range-bounded growth aggregates, shared by the admin overview and growth report. */
import { z } from 'zod';

function toSqliteUtcTimestamp(value: string) {
  return new Date(value).toISOString().slice(0, 19).replace('T', ' ');
}

/** Read registrations once and derive all activity measures from one grouped scan. */
export async function queryGrowthStats(db: D1Database, from: string, to: string) {
  const sqliteFrom = toSqliteUtcTimestamp(from);
  const sqliteTo = toSqliteUtcTimestamp(to);
  const [registrations, activity] = await db.batch([
    db
      .prepare('SELECT COUNT(*) AS count FROM users WHERE created_at >= ? AND created_at < ?')
      .bind(sqliteFrom, sqliteTo),
    db
      .prepare(
        `
      SELECT u.last_country AS country, u.last_colo AS colo, COUNT(*) AS count,
        COALESCE(SUM(s.games_played), 0) AS games
      FROM users u LEFT JOIN user_stats s ON s.user_id = u.id
      WHERE u.updated_at >= ? AND u.updated_at < ?
      GROUP BY u.last_country, u.last_colo
    `,
      )
      .bind(sqliteFrom, sqliteTo),
  ]);
  const registered = z
    .strictObject({ count: z.int().nonnegative() })
    .parse(registrations.results[0]).count;
  const groups = z
    .array(
      z.strictObject({
        country: z.string().nullable(),
        colo: z.string().nullable(),
        count: z.int().nonnegative(),
        games: z.int().nonnegative(),
      }),
    )
    .parse(activity.results);
  const countries = new Map<string, number>();
  const colos = new Map<string, number>();
  let active = 0;
  let totalGames = 0;
  for (const group of groups) {
    active += group.count;
    totalGames += group.games;
    if (group.country !== null)
      countries.set(group.country, (countries.get(group.country) ?? 0) + group.count);
    if (group.colo !== null) colos.set(group.colo, (colos.get(group.colo) ?? 0) + group.count);
  }
  return {
    registered,
    active,
    totalGames,
    countries: [...countries]
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count),
    colos: [...colos].map(([colo, count]) => ({ colo, count })).sort((a, b) => b.count - a.count),
  };
}
