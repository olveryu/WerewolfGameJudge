/**
 * useAuthMutations — TanStack Query mutation hooks for auth operations
 *
 * Each hook wraps a single IAuthService method with useMutation.
 * Retry counts are per-mutation: network-layer retry handled by cfFetch,
 * business-layer retry handled here (e.g., 5xx server errors).
 */

import { useMutation } from '@tanstack/react-query';

import { useServices } from '@/contexts/ServiceContext';

export function useSignInAnonymously() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: () => authService.signInAnonymously(),
    retry: 2,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10000),
  });
}

export function useSignInWithEmail() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: ({ email, password }: { email: string; password: string }) =>
      authService.signInWithEmail(email, password),
    retry: 2,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10000),
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
    retry: 2,
    retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 10000),
  });
}

export function useUpdateProfile() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: (updates: Parameters<typeof authService.updateProfile>[0]) =>
      authService.updateProfile(updates),
    retry: 1,
  });
}

export function useSignOut() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: () => authService.signOut(),
    retry: 0,
  });
}

export function useChangePassword() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: ({ oldPassword, newPassword }: { oldPassword: string; newPassword: string }) =>
      authService.changePassword(oldPassword, newPassword),
    retry: 1,
  });
}

export function useForgotPassword() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: (email: string) => authService.forgotPassword(email),
    retry: 2,
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
    retry: 1,
  });
}

/** 微信 code 一次性，useMutation 层不重试（cfFetch 网络层重试仍生效） */
export function useSignInWithWechat() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: (code: string) => authService.signInWithWechat(code),
    retry: 0,
  });
}

/** 微信 code 一次性，useMutation 层不重试 */
export function useBindWechat() {
  const { authService } = useServices();
  return useMutation({
    mutationFn: (code: string) => authService.bindWechat(code),
    retry: 0,
  });
}
