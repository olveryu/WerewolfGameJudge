/** The signed-in user's feedback history, cached per user and reloaded after each write. */
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { type FeedbackItem, getFeedbackHistory } from '../services/feedbackApi';

/**
 * Query the history for `userId` (disabled while signed out). `reloadHistory` throws on failure
 * so a write that cannot show its result reports it; `updateHistory` applies a confirmed write.
 */
export function useFeedbackHistory(userId: string | null) {
  const queryClient = useQueryClient();
  const queryKey = ['feedbackHistory', userId] as const;
  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => getFeedbackHistory(signal),
    enabled: userId !== null,
    // Admin replies arrive out of band: every mount reloads, showing the cache meanwhile.
    staleTime: 0,
  });
  const reloadHistory = async (): Promise<void> => {
    await query.refetch({ throwOnError: true });
  };
  const updateHistory = (update: (items: FeedbackItem[]) => FeedbackItem[]): void => {
    queryClient.setQueryData<FeedbackItem[]>(queryKey, (items) =>
      items === undefined ? undefined : update(items),
    );
  };
  return { query, reloadHistory, updateHistory };
}
