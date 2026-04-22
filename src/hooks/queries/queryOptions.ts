/**
 * queryOptions — type-safe query option factories (TanStack Query v5 pattern).
 *
 * Co-locates queryKey + queryFn for each query. Consumers use the factory
 * directly in useQuery/useAuthenticatedQuery, and access `.queryKey` for
 * invalidation or getQueryData (DataTag enables automatic type inference).
 */

import { queryOptions } from '@tanstack/react-query';

import { fetchGachaStatus } from '@/services/feature/GachaService';
import {
  fetchUserProfile,
  fetchUserStats,
  fetchUserUnlocks,
} from '@/services/feature/StatsService';

export const userStatsOptions = () =>
  queryOptions({
    queryKey: ['userStats'] as const,
    queryFn: fetchUserStats,
    staleTime: 5 * 60_000,
  });

export const userProfileOptions = (userId: string) =>
  queryOptions({
    queryKey: ['userProfile', userId] as const,
    queryFn: () => fetchUserProfile(userId),
  });

export const userUnlocksOptions = (userId: string) =>
  queryOptions({
    queryKey: ['userUnlocks', userId] as const,
    queryFn: () => fetchUserUnlocks(userId).then((r) => r.unlockedItems),
  });

export const gachaStatusOptions = () =>
  queryOptions({
    queryKey: ['gachaStatus'] as const,
    queryFn: fetchGachaStatus,
    staleTime: 60_000,
  });
