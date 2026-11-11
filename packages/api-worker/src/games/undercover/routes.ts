/** GET /api/games/undercover/inventory/categories exposes active categories, never word pairs.
 * @throws 500 when inventory cannot be read or contains an invalid category.
 */
import {
  UNDERCOVER_CATEGORIES,
  UNDERCOVER_CATEGORY_MIN_ACTIVE_PAIRS,
} from '@game-judge/game-engine/games/undercover/public';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../../env';

const categoryRowSchema = z.strictObject({ category: z.enum(UNDERCOVER_CATEGORIES) });

export const undercoverInventoryRoutes = new Hono<AppEnv>();

undercoverInventoryRoutes.get('/categories', async (context) => {
  const [inventory, categories] = await context.env.DB.batch([
    context.env.DB.prepare(
      "SELECT EXISTS(SELECT 1 FROM undercover_word_pairs WHERE status = 'active') AS has_words",
    ),
    context.env.DB.prepare(
      "SELECT category FROM undercover_word_pairs WHERE status = 'active' GROUP BY category HAVING COUNT(*) >= ? ORDER BY category",
    ).bind(UNDERCOVER_CATEGORY_MIN_ACTIVE_PAIRS),
  ]);
  const { has_words } = z
    .strictObject({ has_words: z.int().min(0).max(1) })
    .parse(inventory.results[0]);
  const { results } = categories;
  const availableCategories = results.map((row) => categoryRowSchema.parse(row).category);
  return context.json({ availableCategories, hasAnyWords: has_words === 1 });
});
