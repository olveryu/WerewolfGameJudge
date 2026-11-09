/** TanStack Query mutations wrapping `IAuthService`; network retry lives in `ApiClient`. */
import { useMutation } from '@tanstack/react-query';

import { useServices } from '@/contexts/ServiceContext';

export function useSignInAnonymously() {
  const { authService } = useServices();
  return useMutation({ mutationFn: () => authService.signInAnonymously() });
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

export function useSignOut() {
  const { authService } = useServices();
  return useMutation({ mutationFn: () => authService.signOut() });
}

export function useForgotPassword() {
  const { authService } = useServices();
  return useMutation({ mutationFn: (email: string) => authService.forgotPassword(email) });
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
