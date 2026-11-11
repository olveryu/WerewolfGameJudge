/** Indexed, stable cursor pagination for the admin user directory. */
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';

const sortSchema = z.enum(['created_at', 'updated_at', 'level', 'games_played']);
const querySchema = z.strictObject({
  sort: sortSchema.default('created_at'),
  order: z.enum(['asc', 'desc']).default('desc'),
  type: z.enum(['registered', 'anonymous']).optional(),
  country: z
    .string()
    .regex(/^[A-Z]{2}$/)
    .optional(),
  q: z.string().trim().min(1).max(200).optional(),
  cursor: z.string().max(4096).optional(),
});
const cursorSchema = z.strictObject({
  scope: z.string(),
  value: z.union([z.string(), z.int().nonnegative()]),
  id: z.string().min(1),
});
type DirectoryQuery = z.output<typeof querySchema>;
interface DirectoryRow {
  id: string;
  displayName: string | null;
  email: string | null;
  isAnonymous: number;
  lastCountry: string | null;
  lastColo: string | null;
  createdAt: string;
  updatedAt: string;
  level: number;
  xp: number;
  gamesPlayed: number;
  sortValue: string | number;
}

function cursorScope(query: DirectoryQuery): string {
  return JSON.stringify([query.sort, query.order, query.type, query.country, query.q]);
}

function decodeCursor(query: DirectoryQuery) {
  if (query.cursor === undefined) return null;
  let value: unknown;
  try {
    value = JSON.parse(
      new TextDecoder().decode(Uint8Array.from(atob(query.cursor), (c) => c.charCodeAt(0))),
    );
  } catch {
    throw new HTTPException(400, { message: 'INVALID_ADMIN_CURSOR' });
  }
  const parsed = cursorSchema.safeParse(value);
  const numeric = query.sort === 'level' || query.sort === 'games_played';
  if (
    !parsed.success ||
    parsed.data.scope !== cursorScope(query) ||
    (typeof parsed.data.value === 'number') !== numeric
  ) {
    throw new HTTPException(400, { message: 'INVALID_ADMIN_CURSOR' });
  }
  return parsed.data;
}

/** Validate directory filters and return at most 50 users without a total-count scan. */
export async function queryUserDirectory(db: D1Database, input: Record<string, string>) {
  const parsed = querySchema.safeParse(input);
  if (!parsed.success) throw new HTTPException(400, { message: 'INVALID_ADMIN_USER_QUERY' });
  const query = parsed.data;
  const cursor = decodeCursor(query);
  const statsFirst = query.sort === 'level' || query.sort === 'games_played';
  const column = statsFirst ? `s.${query.sort}` : `u.${query.sort}`;
  const idColumn = statsFirst ? 's.user_id' : 'u.id';
  const conditions: string[] = [];
  const bindings: (string | number)[] = [];
  if (query.type !== undefined) {
    conditions.push('u.is_anonymous = ?');
    bindings.push(query.type === 'anonymous' ? 1 : 0);
  }
  if (query.country !== undefined) {
    conditions.push('u.last_country = ?');
    bindings.push(query.country);
  }
  if (query.q !== undefined) {
    conditions.push(query.q.includes('@') ? 'u.email = ?' : "u.display_name LIKE ? ESCAPE '\\'");
    bindings.push(query.q.includes('@') ? query.q : `%${query.q.replace(/[\\%_]/g, '\\$&')}%`);
  }
  if (cursor !== null) {
    conditions.push(`(${column}, ${idColumn}) ${query.order === 'asc' ? '>' : '<'} (?, ?)`);
    bindings.push(cursor.value, cursor.id);
  }
  const from = statsFirst
    ? 'user_stats s INNER JOIN users u ON u.id = s.user_id'
    : 'users u LEFT JOIN user_stats s ON s.user_id = u.id';
  const result = await db
    .prepare(
      `
    SELECT u.id, u.display_name AS displayName, u.email, u.is_anonymous AS isAnonymous,
      u.last_country AS lastCountry, u.last_colo AS lastColo,
      u.created_at AS createdAt, u.updated_at AS updatedAt,
      COALESCE(s.level, 0) AS level, COALESCE(s.xp, 0) AS xp,
      COALESCE(s.games_played, 0) AS gamesPlayed, ${column} AS sortValue
    FROM ${from} ${conditions.length === 0 ? '' : `WHERE ${conditions.join(' AND ')}`}
    ORDER BY ${column} ${query.order}, ${idColumn} ${query.order} LIMIT 51
  `,
    )
    .bind(...bindings)
    .all<DirectoryRow>();
  const page = result.results.slice(0, 50);
  const last = page.at(-1);
  const nextCursor =
    result.results.length > 50 && last !== undefined
      ? btoa(
          String.fromCharCode(
            ...new TextEncoder().encode(
              JSON.stringify({
                scope: cursorScope(query),
                value: last.sortValue,
                id: last.id,
              }),
            ),
          ),
        )
      : null;
  return {
    users: page.map(({ sortValue: _sortValue, ...user }) => ({
      ...user,
      isAnonymous: user.isAnonymous === 1,
    })),
    nextCursor,
  };
}
