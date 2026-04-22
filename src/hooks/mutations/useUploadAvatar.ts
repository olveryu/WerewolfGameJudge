/**
 * useUploadAvatar — TanStack Query mutation hook for avatar upload
 *
 * Separate from auth mutations: belongs to storage/upload domain.
 */

import { useMutation } from '@tanstack/react-query';

import { useServices } from '@/contexts/ServiceContext';

export function useUploadAvatar() {
  const { avatarUploadService } = useServices();
  return useMutation({
    mutationFn: (fileUri: string) => avatarUploadService.uploadAvatar(fileUri),
    retry: 1,
  });
}
