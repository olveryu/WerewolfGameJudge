/** Test-only D1 wrapper that totals the rows D1 reports as read and written. */

interface RowCounts {
  rowsRead: number;
  rowsWritten: number;
}

export interface RowCountingDb {
  /** Pass this wherever production code takes a D1Database. */
  readonly db: D1Database;
  readonly counts: Readonly<RowCounts>;
  reset(): void;
}

/**
 * Wrap a D1 database so every statement run through it adds its
 * `meta.rows_read` and `meta.rows_written` to a running total. `first()` hides
 * the meta, so it is served through `all()` to keep the totals complete.
 */
export function createRowCountingDb(target: D1Database): RowCountingDb {
  const counts: RowCounts = { rowsRead: 0, rowsWritten: 0 };
  const originals = new WeakMap<object, D1PreparedStatement>();
  const record = (result: D1Result): void => {
    counts.rowsRead += result.meta.rows_read;
    counts.rowsWritten += result.meta.rows_written;
  };
  const wrapStatement = (statement: D1PreparedStatement): D1PreparedStatement => {
    const wrapped = {
      bind: (...values: unknown[]) => wrapStatement(statement.bind(...values)),
      all: async () => {
        const result = await statement.all();
        record(result);
        return result;
      },
      run: async () => {
        const result = await statement.run();
        record(result);
        return result;
      },
      first: async (column?: string) => {
        const result = await statement.all<Record<string, unknown>>();
        record(result);
        const row = result.results[0];
        if (row === undefined) return null;
        return column === undefined ? row : (row[column] ?? null);
      },
      raw: () => {
        throw new Error('RowCountingDb does not support raw()');
      },
    } as unknown as D1PreparedStatement;
    originals.set(wrapped, statement);
    return wrapped;
  };
  const db = {
    prepare: (query: string) => wrapStatement(target.prepare(query)),
    batch: async (statements: D1PreparedStatement[]) => {
      const results = await target.batch(
        statements.map((statement) => originals.get(statement) ?? statement),
      );
      results.forEach(record);
      return results;
    },
    exec: (query: string) => target.exec(query),
  } as unknown as D1Database;
  return {
    db,
    counts,
    reset: () => {
      counts.rowsRead = 0;
      counts.rowsWritten = 0;
    },
  };
}
