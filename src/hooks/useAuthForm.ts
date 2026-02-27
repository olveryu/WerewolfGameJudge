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
import Toast from 'react-native-toast-message';

import { useAuthContext as useAuth } from '@/contexts/AuthContext';
import { navigateTo } from '@/navigation/navigationRef';
import { showAlert } from '@/utils/alert';
import { getErrorMessage } from '@/utils/errorUtils';

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
  /** Show '登录成功！' toast on email sign-in (Settings: true, Home: false) */
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
  // Handlers
  handleEmailAuth: () => Promise<void>;
  handleAnonymousLogin: () => Promise<void>;
  resetForm: () => void;
  toggleSignUp: () => void;
}

export function useAuthForm({
  onSuccess,
  logger,
  showSuccessOnLogin,
}: UseAuthFormOptions): AuthFormResult {
  const { signInAnonymously, signUpWithEmail, signInWithEmail } = useAuth();

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
      showAlert('请输入邮箱和密码');
      return;
    }

    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, displayName || undefined);
        showAlert('注册成功！');
        Toast.show({
          type: 'info',
          text1: '可在设置中自定义头像和昵称',
          text2: '点击前往设置 →',
          position: 'bottom',
          visibilityTime: 5000,
          onPress: () => {
            Toast.hide();
            navigateTo('Settings');
          },
        });
      } else {
        await signInWithEmail(email, password);
        if (showSuccessOnLogin) {
          showAlert('登录成功！');
        }
      }
      onSuccess();
      resetForm();
    } catch (e: unknown) {
      const message = getErrorMessage(e);
      logger.warn('Email auth failed:', message);
      showAlert(isSignUp ? '注册失败' : '登录失败', message);
    }
  }, [
    email,
    password,
    displayName,
    isSignUp,
    signUpWithEmail,
    signInWithEmail,
    onSuccess,
    resetForm,
    logger,
    showSuccessOnLogin,
  ]);

  const handleAnonymousLogin = useCallback(async () => {
    try {
      await signInAnonymously();
      onSuccess();
    } catch (e: unknown) {
      const message = getErrorMessage(e);
      logger.warn('Anonymous login failed:', message);
      showAlert('登录失败', message || '请稍后重试');
    }
  }, [signInAnonymously, onSuccess, logger]);

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
    handleEmailAuth,
    handleAnonymousLogin,
    resetForm,
    toggleSignUp,
  };
}
