/** Public category metadata only; word pairs remain owned by the room allocation endpoint. */
import {
  UNDERCOVER_CATEGORIES,
  type UndercoverCategory,
} from '@game-judge/game-engine/games/undercover/public';
import { queryOptions } from '@tanstack/react-query';

import { apiClient } from '@/platform/http/client';

function parseInventory(value: unknown): {
  availableCategories: readonly UndercoverCategory[];
  hasAnyWords: boolean;
} {
  if (
    value === null ||
    typeof value !== 'object' ||
    !('availableCategories' in value) ||
    !Array.isArray(value.availableCategories) ||
    !('hasAnyWords' in value) ||
    typeof value.hasAnyWords !== 'boolean' ||
    Object.keys(value).length !== 2
  )
    throw new Error('Invalid Undercover inventory response');
  const availableCategories = value.availableCategories.map((entry: unknown) => {
    const category = UNDERCOVER_CATEGORIES.find((candidate) => candidate === entry);
    if (category === undefined) throw new Error('Invalid Undercover inventory category');
    return category;
  });
  return { availableCategories, hasAnyWords: value.hasAnyWords };
}

export const undercoverInventoryOptions = queryOptions({
  queryKey: ['games', 'undercover', 'inventory', 'categories'] as const,
  queryFn: () =>
    apiClient.json({
      method: 'GET',
      path: '/api/games/undercover/inventory/categories',
      auth: 'required',
      idempotent: true,
      decode: parseInventory,
    }),
  staleTime: 0,
});
