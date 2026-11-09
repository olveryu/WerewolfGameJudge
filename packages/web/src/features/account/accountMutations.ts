/** Account mutations: profile edits and password change. */
import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useServices } from '@/contexts/ServiceContext';
import { handleError } from '@/utils/errorPipeline';
import { isAbortError, isExpectedError } from '@/utils/errorUtils';
import { createLogger } from '@/utils/logger';

const accountLog = createLogger('Account');

/** Profile caches other screens read; refreshed after a profile write. */
const PROFILE_QUERY_PREFIX = ['userProfile'] as const;

export function useUpdateProfile() {
  const { authService } = useServices();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (updates: Parameters<typeof authService.updateProfile>[0]) =>
      authService.updateProfile(updates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: PROFILE_QUERY_PREFIX });
    },
  });
}

export function useChangePassword() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: ({ oldPassword, newPassword }: { oldPassword: string; newPassword: string }) =>
      authService.changePassword(oldPassword, newPassword),
  });
}

/**
 * Refreshes the profile after a confirmed write.
 *
 * @returns false when only the refresh failed; the caller reports "saved, not refreshed"
 */
export async function refreshSavedProfile(refreshUser: () => Promise<void>): Promise<boolean> {
  try {
    await refreshUser();
    return true;
  } catch (error) {
    if (isAbortError(error)) throw error;
    handleError(error, {
      label: '刷新已保存的资料',
      logger: accountLog,
      feedback: false,
      isExpected: isExpectedError,
    });
    return false;
  }
}
