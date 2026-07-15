/** TanStack Query options owned by the gacha feature. */

import { queryOptions } from '@tanstack/react-query';

import { fetchGachaStatus } from '../services/gachaApi';

export const gachaStatusOptions = () =>
  queryOptions({
    queryKey: ['gachaStatus'] as const,
    queryFn: fetchGachaStatus,
    staleTime: 60_000,
  });
