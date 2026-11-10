/** TanStack Query options owned by the gacha feature. */

import { queryOptions } from '@tanstack/react-query';

import { fetchGachaStatus } from '../services/gachaApi';

export const gachaStatusOptions = (userId: string | null) =>
  queryOptions({
    queryKey: ['gachaStatus', userId] as const,
    queryFn: ({ signal }) => fetchGachaStatus(signal),
    enabled: userId !== null,
    staleTime: 60_000,
  });
