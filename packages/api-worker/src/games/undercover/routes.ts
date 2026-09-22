/** GET /api/games/undercover/inventory/categories exposes active categories, never word pairs.
 * @throws 500 when inventory cannot be read or contains an invalid category.
 */
import { UNDERCOVER_CATEGORIES } from '@game-judge/game-engine/games/undercover/public';
import { Hono } from 'hono';
import { z } from 'zod';

import type { AppEnv } from '../../env';

const categoryRowSchema = z.strictObject({ category: z.enum(UNDERCOVER_CATEGORIES) });

export const undercoverInventoryRoutes = new Hono<AppEnv>();

undercoverInventoryRoutes.get('/categories', async (context) => {
  const { results } = await context.env.DB.prepare(
    "SELECT DISTINCT category FROM undercover_word_pairs WHERE status = 'active' ORDER BY category",
  ).all();
  const availableCategories = results.map((row) => categoryRowSchema.parse(row).category);
  return context.json({ availableCategories });
});
