/** GET /api/games/undercover/inventory/categories exposes active categories, never word pairs.
 * Reads the trigger-maintained draw index, one row per partition, instead of
 * scanning the word table: a partition's members are exactly its active pairs.
 * @throws 500 when the index cannot be read or holds an invalid partition or member list.
 */
import {
  UNDERCOVER_CATEGORY_MIN_ACTIVE_PAIRS,
  UNDERCOVER_WORD_CATEGORY_CATALOG,
  type UndercoverCategory,
} from '@game-judge/game-engine/games/undercover/public';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../../env';
import { decodeDrawMembers } from '../../platform/wordSupply/wordDrawSets';

const ALL_PARTITION = 'all';

const partitionRowSchema = z.strictObject({
  partition_key: z.union([z.literal(ALL_PARTITION), z.enum(UNDERCOVER_WORD_CATEGORY_CATALOG.ids)]),
  members: z.string(),
});

export const undercoverInventoryRoutes = new Hono<AppEnv>();

undercoverInventoryRoutes.get('/categories', async (context) => {
  const { results } = await context.env.DB.prepare(
    "SELECT partition_key, members FROM word_draw_index WHERE pool = 'undercover' ORDER BY partition_key",
  ).all();
  let hasAnyWords = false;
  const availableCategories: UndercoverCategory[] = [];
  for (const row of results) {
    const { partition_key, members } = partitionRowSchema.parse(row);
    const memberCount = decodeDrawMembers(members).length;
    if (partition_key === ALL_PARTITION) {
      hasAnyWords = memberCount > 0;
    } else if (memberCount >= UNDERCOVER_CATEGORY_MIN_ACTIVE_PAIRS) {
      availableCategories.push(partition_key);
    }
  }
  return context.json({ availableCategories, hasAnyWords });
});
