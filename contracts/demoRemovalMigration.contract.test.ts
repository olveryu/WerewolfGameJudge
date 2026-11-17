import { readFileSync } from 'node:fs';
import path from 'node:path';

import { expect, it } from 'vitest';

const migration = readFileSync(
  path.resolve('packages/api-worker/migrations/0088_remove_demo_game.sql'),
  'utf8',
);

it('removes legacy demo records before excluding the game type from D1 constraints', () => {
  const roomsCleanup = migration.indexOf("DELETE FROM rooms WHERE game_type = 'demo';");
  const rewardCleanup = migration.indexOf(
    "DELETE FROM product_game_reward_results WHERE game_type = 'demo';",
  );
  const claimsCleanup = migration.indexOf("json_extract(input_json, '$.gameType') = 'demo';");
  const rebuild = migration.indexOf('CREATE TABLE rooms_next');

  expect(roomsCleanup).toBeGreaterThan(-1);
  expect(rewardCleanup).toBeGreaterThan(roomsCleanup);
  expect(claimsCleanup).toBeGreaterThan(rewardCleanup);
  expect(rebuild).toBeGreaterThan(claimsCleanup);
  expect([
    ...migration.matchAll(/game_type TEXT NOT NULL CHECK \(game_type IN \(([^)]*)\)\)/g),
  ]).toHaveLength(2);
  for (const [, gameTypes] of migration.matchAll(
    /game_type TEXT NOT NULL CHECK \(game_type IN \(([^)]*)\)\)/g,
  )) {
    expect(gameTypes).not.toContain("'demo'");
    expect(gameTypes).toContain("'avalon'");
  }
});
