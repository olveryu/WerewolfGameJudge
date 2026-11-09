/**
 * queryOptions — type-safe query option factories (TanStack Query v5 pattern).
 *
 * Co-locates queryKey + queryFn for each query. Consumers use the factory
 * directly in useQuery/useAuthenticatedQuery, and access `.queryKey` for
 * invalidation or getQueryData (DataTag enables automatic type inference).
 */

import { queryOptions } from '@tanstack/react-query';

import {
  fetchUserProfile,
  fetchUserStats,
  fetchUserUnlocks,
} from '@/features/account/services/accountApi';

export const accountQueryKeys = {
  stats: (userId: string | null) => ['userStats', userId] as const,
  profiles: ['userProfile'] as const,
  profile: (userId: string) => ['userProfile', userId] as const,
  unlocks: (userId: string) => ['userUnlocks', userId] as const,
};

export const userStatsOptions = (userId: string | null) =>
  queryOptions({
    queryKey: accountQueryKeys.stats(userId),
    queryFn: ({ signal }) => fetchUserStats(signal),
    enabled: userId !== null,
    staleTime: 5 * 60_000,
  });

export const userProfileOptions = (userId: string) =>
  queryOptions({
    queryKey: accountQueryKeys.profile(userId),
    queryFn: () => fetchUserProfile(userId),
    staleTime: 0,
  });

export const userUnlocksOptions = (userId: string) =>
  queryOptions({
    queryKey: accountQueryKeys.unlocks(userId),
    queryFn: () => fetchUserUnlocks(userId).then((r) => r.unlockedItems),
  });
