/** Zod schemas for /api/gacha/* endpoints */

import { z } from 'zod';

/** POST /api/gacha/draw — body */
export const gachaDrawSchema = z.object({
  drawType: z.enum(['normal', 'golden']),
  count: z.number().int().min(1).max(10).default(1),
});
