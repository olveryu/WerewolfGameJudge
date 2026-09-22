/** Public category metadata only; word pairs remain owned by the room allocation endpoint. */
import {
  UNDERCOVER_CATEGORIES,
  type UndercoverCategory,
} from '@game-judge/game-engine/games/undercover/public';
import { queryOptions } from '@tanstack/react-query';

import { cfGet } from '@/services/cloudflare/cfFetch';

function parseInventory(value: unknown): readonly UndercoverCategory[] {
  if (
    value === null ||
    typeof value !== 'object' ||
    !('availableCategories' in value) ||
    !Array.isArray(value.availableCategories) ||
    Object.keys(value).length !== 1
  )
    throw new Error('Invalid Undercover inventory response');
  return value.availableCategories.map((entry: unknown) => {
    const category = UNDERCOVER_CATEGORIES.find((candidate) => candidate === entry);
    if (category === undefined) throw new Error('Invalid Undercover inventory category');
    return category;
  });
}

export const undercoverInventoryOptions = queryOptions({
  queryKey: ['games', 'undercover', 'inventory', 'categories'] as const,
  queryFn: () => cfGet('/api/games/undercover/inventory/categories', parseInventory),
  staleTime: 0,
});
