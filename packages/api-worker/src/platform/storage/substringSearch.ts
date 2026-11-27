/**
 * Substring search for user-typed terms.
 *
 * D1 caps a LIKE or GLOB pattern at 50 bytes, so binding `'%' || term || '%'` as a LIKE pattern
 * fails with "pattern too complex" once the term reaches about 16 CJK characters. `instr` takes
 * the term as a plain string: no length cap and no `%`/`_` wildcards to escape. `lower()` on both
 * sides keeps LIKE's case rule, which folds ASCII letters only (SQLite without ICU, as in D1).
 */

import type { SqlCondition } from './sqlCondition';

/**
 * Rows whose `column` contains `term`, ASCII case-insensitively and with every character literal.
 * `column` is a column reference written in source, never user input. An empty term matches every
 * row, so asking for one is a caller bug: it throws rather than silently dropping the filter.
 */
export function containsIgnoringAsciiCase(column: string, term: string): SqlCondition {
  if (term === '') throw new Error(`Substring search on ${column} needs a non-empty term`);
  return { sql: `instr(lower(${column}), lower(?)) > 0`, params: [term] };
}
