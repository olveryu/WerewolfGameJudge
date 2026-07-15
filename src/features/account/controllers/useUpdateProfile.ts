/** Account profile update mutation and account-query invalidation. */

import { useMutation, useQueryClient } from '@tanstack/react-query';

import { useServices } from '@/contexts/ServiceContext';

import { accountQueryKeys } from '../queries/accountQueryOptions';

export function useUpdateProfile() {
  const { authService } = useServices();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (updates: Parameters<typeof authService.updateProfile>[0]) =>
      authService.updateProfile(updates),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: accountQueryKeys.profiles });
    },
  });
}
