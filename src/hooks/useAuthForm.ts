/**
 * useAuthForm — 登录/注册表单 state + handlers
 *
 * 封装 HomeScreen 和 SettingsScreen 共享的认证逻辑：
 * - 4 个表单 state（email / password / displayName / isSignUp）
 * - handleEmailAuth（校验 → 调 API → onSuccess → 清理 → 错误处理）
 * - handleAnonymousLogin（try/catch + onSuccess + 错误处理）
 * - resetForm / toggleSignUp
 *
 * 管理 form state、调用 AuthContext API 和 showAlert。
 * 不硬编码样式值，不使用 console.*，不 import service 层。
 */
import { useCallback, useState } from 'react';
import { toast } from 'sonner-native';

import { useAuthContext as useAuth } from '@/contexts/AuthContext';
import {
  useSignInAnonymously,
  useSignInWithEmail,
  useSignUpWithEmail,
} from '@/hooks/mutations/useAuthMutations';
import { showErrorAlert } from '@/utils/alertPresets';
import { getErrorMessage } from '@/utils/errorUtils';
import { mapAuthError } from '@/utils/logger';

/** Logger interface — matches react-native-logs extended logger */
interface Logger {
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

interface UseAuthFormOptions {
  /** Called after successful login/signup (close modal, reset UI, etc.) */
  onSuccess: () => void;
  /** Named logger for the calling screen */
  logger: Logger;
  /** Show '登录成功' toast on email sign-in (Settings: true, Home: false) */
  showSuccessOnLogin?: boolean;
}

interface AuthFormResult {
  // Form state
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  displayName: string;
  setDisplayName: (v: string) => void;
  isSignUp: boolean;
  setIsSignUp: (v: boolean) => void;
  // Handlers
  handleEmailAuth: () => Promise<void>;
  handleAnonymousLogin: () => Promise<void>;
  resetForm: () => void;
  toggleSignUp: () => void;
  /** True while any auth mutation is in flight */
  isSubmitting: boolean;
}

export function useAuthForm({
  onSuccess,
  logger,
  showSuccessOnLogin,
}: UseAuthFormOptions): AuthFormResult {
  const { user, refreshUser } = useAuth();
  const { mutateAsync: signInAnonymously, isPending: isAnonymousPending } = useSignInAnonymously();
  const { mutateAsync: signUpWithEmail, isPending: isSignUpPending } = useSignUpWithEmail();
  const { mutateAsync: signInWithEmail, isPending: isSignInPending } = useSignInWithEmail();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const resetForm = useCallback(() => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setIsSignUp(false);
  }, []);

  const handleEmailAuth = useCallback(async () => {
    if (!email || !password) {
      toast.warning('请输入邮箱和密码');
      return;
    }

    try {
      if (isSignUp) {
        const wasAnonymous = user?.isAnonymous;
        await signUpWithEmail({
          email,
          password,
          displayName: displayName || undefined,
        });
        await refreshUser();
        if (wasAnonymous) {
          // Anonymous → email upgrade: userId preserved, already in Settings
          toast.success('绑定成功');
        } else {
          toast.success('注册成功');
        }
      } else {
        await signInWithEmail({ email, password });
        await refreshUser();
        if (showSuccessOnLogin) {
          toast.success('登录成功');
        }
      }
      onSuccess();
      resetForm();
    } catch (e: unknown) {
      const message = mapAuthError(getErrorMessage(e));
      logger.warn('Email auth failed:', message);
      showErrorAlert(isSignUp ? '注册失败' : '登录失败', message);
    }
  }, [
    email,
    password,
    displayName,
    isSignUp,
    user?.isAnonymous,
    signUpWithEmail,
    signInWithEmail,
    refreshUser,
    onSuccess,
    resetForm,
    logger,
    showSuccessOnLogin,
  ]);

  const handleAnonymousLogin = useCallback(async () => {
    try {
      await signInAnonymously();
      await refreshUser();
      if (showSuccessOnLogin) {
        toast.success('登录成功');
      }
      onSuccess();
    } catch (e: unknown) {
      const message = getErrorMessage(e);
      logger.warn('Anonymous login failed:', message);
      showErrorAlert('登录失败', message);
    }
  }, [signInAnonymously, refreshUser, onSuccess, logger, showSuccessOnLogin]);

  const isSubmitting = isAnonymousPending || isSignUpPending || isSignInPending;

  const toggleSignUp = useCallback(() => {
    setIsSignUp((prev) => !prev);
  }, []);

  return {
    email,
    setEmail,
    password,
    setPassword,
    displayName,
    setDisplayName,
    isSignUp,
    setIsSignUp,
    handleEmailAuth,
    handleAnonymousLogin,
    resetForm,
    toggleSignUp,
    isSubmitting,
  };
}
