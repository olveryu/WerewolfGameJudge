/** Account-scoped unread replies shared by app lifecycle and Home, never by screen-local state. */
import { useQueryClient } from '@tanstack/react-query';

import { useAuthContext } from '@/contexts/AuthContext';
import { useAuthenticatedQuery } from '@/features/auth/queries/useAuthenticatedQuery';
import { useAppVisibility } from '@/features/product/hooks/useAppVisibility';

import { getUnreadFeedbackCount } from '../services/feedbackApi';

/** Observe unread replies and publish confirmed read counts into the same account cache. */
export function useUnreadFeedback() {
  const { user } = useAuthContext();
  const queryClient = useQueryClient();
  const isAppVisible = useAppVisibility();
  const queryKey = ['unreadFeedbackCount', user?.id ?? null] as const;
  const query = useAuthenticatedQuery({
    queryKey,
    queryFn: ({ signal }) => getUnreadFeedbackCount(signal),
    enabled: isAppVisible,
  });
  const setUnreadFeedbackCount = (count: number) => queryClient.setQueryData(queryKey, count);
  return { ...query, setUnreadFeedbackCount };
}
