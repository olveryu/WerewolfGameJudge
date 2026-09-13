// Fashion Shadow vertical slice has no asynchronous game-owned effects.

import type { FashionEffect } from '@game-judge/game-engine/games/fashion-shadow/public';
import { z } from 'zod';

export const fashionEffectSchema: z.ZodType<FashionEffect> = z.never();

export function handleFashionEffect(_effect: FashionEffect): Promise<void> {
  throw new Error('Fashion Shadow vertical slice does not define asynchronous effects');
}
