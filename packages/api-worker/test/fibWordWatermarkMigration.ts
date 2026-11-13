import type { D1Migration } from '@cloudflare/vitest-plugin';

/** Find the unique 0067 statement that converts fibking watermarks into seen ranges. */
export function getFibWatermarkConversion(migrations: D1Migration[]): string {
  const migration = migrations.find(({ name }) => name === '0067_shared_word_draw.sql');
  if (migration === undefined) throw new Error('Missing shared word draw migration');

  const conversions = migration.queries.filter((query) =>
    /(?:^|\r?\n)INSERT INTO word_seen \(user_id, pool, seen\)\r?\nSELECT user_id, 'fibking', ',1-' \|\| sequence_number \|\| ',' FROM fib_word_progress;?\s*$/.test(
      query,
    ),
  );
  const conversion = conversions[0];
  if (conversions.length !== 1 || conversion === undefined) {
    throw new Error(
      `Expected one fibking watermark conversion statement, found ${conversions.length}`,
    );
  }
  return conversion;
}
