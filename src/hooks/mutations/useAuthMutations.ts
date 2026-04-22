/**
 * useAuthMutations — TanStack Query mutation hooks for auth operations
 *
 * Each hook wraps a single IAuthService method with useMutation.
 * Network retry is handled by cfFetch (fetchWithRetry), so mutation hooks
 * use default retry: 0. Wechat hooks rely on service-layer noRetry for
 * one-time code protection.
 */

import { useMutation } from '@tanstack/react-query';

import { useServices } from '@/contexts/ServiceContext';

export function useSignInAnonymously() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: () => authService.signInAnonymously(),
  });
}

export function useSignInWithEmail() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authService.signInWithEmail(email, password),
  });
}

export function useSignUpWithEmail() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: ({
      email,
      password,
      displayName,
    }: {
      email: string;
      password: string;
      displayName?: string;
    }) => authService.signUpWithEmail(email, password, displayName),
  });
}

export function useUpdateProfile() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: (updates: Parameters<typeof authService.updateProfile>[0]) =>
      authService.updateProfile(updates),
  });
}

export function useSignOut() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: () => authService.signOut(),
  });
}

export function useChangePassword() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: ({ oldPassword, newPassword }: { oldPassword: string; newPassword: string }) =>
      authService.changePassword(oldPassword, newPassword),
  });
}

export function useForgotPassword() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: (email: string) => authService.forgotPassword(email),
  });
}

export function useResetPassword() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: ({
      email,
      code,
      newPassword,
    }: {
      email: string;
      code: string;
      newPassword: string;
    }) => authService.resetPassword(email, code, newPassword),
  });
}
