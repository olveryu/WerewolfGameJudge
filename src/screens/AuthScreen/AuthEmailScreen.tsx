/**
 * AuthEmailScreen — 邮箱登录/注册表单（Modal Screen）
 *
 * 接收 route params 配置（mode / formTitle / signOutFirst / showToggleMode 等）。
 * 登录/注册成功后 goBack() 回到 caller screen，caller 通过 auth context 响应状态变更。
 * signUp 且 navigateSettingsOnSignUp=true 时 replace 到 Settings。
 * 不含游戏业务逻辑，不 import service 层（signOut 除外）。
 */
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as Sentry from '@sentry/react-native';
import React, { useCallback, useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { EmailForm } from '@/components/auth';
import { LAST_ROOM_CODE_KEY } from '@/config/storageKeys';
import { useAuthContext } from '@/contexts/AuthContext';
import { useSignOut } from '@/hooks/mutations/useAuthMutations';
import { useAuthForm } from '@/hooks/useAuthForm';
import { storage } from '@/lib/storage';
import { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme';
import { showErrorAlert } from '@/utils/alertPresets';
import { authLog, isExpectedAuthError, mapAuthError } from '@/utils/logger';

import { createAuthScreenStyles } from './AuthScreen.styles';

type RouteProp = import('@react-navigation/native').RouteProp<RootStackParamList, 'AuthEmail'>;

export const AuthEmailScreen: React.FC = () => {
  const { width: screenWidth } = useWindowDimensions();
  const styles = useMemo(() => createAuthScreenStyles(colors, screenWidth), [screenWidth]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'AuthEmail'>>();
  const route = useRoute<RouteProp>();

  const {
    mode,
    formTitle,
    showToggleMode = true,
    signOutFirst = false,
    showSuccessOnLogin = false,
    hideDisplayName = false,
    navigateSettingsOnSignUp = false,
    openedFromAuthLogin = false,
  } = route.params;

  const { error: authError, refreshUser } = useAuthContext();
  const signOutMutation = useSignOut();

  const handleSuccess = useCallback(() => {
    if (navigateSettingsOnSignUp && isSignUpRef.current) {
      // Pop AuthEmail + AuthLogin, then navigate to Settings
      navigation.pop(2);
      navigation.navigate('Settings');
    } else if (openedFromAuthLogin) {
      // Pop AuthEmail + AuthLogin back to the original caller
      navigation.pop(2);
    } else {
      // Opened directly (e.g. from Settings) — pop this screen only
      navigation.goBack();
    }
  }, [navigation, navigateSettingsOnSignUp, openedFromAuthLogin]);

  const {
    email,
    setEmail,
    password,
    setPassword,
    displayName,
    setDisplayName,
    isSignUp,
    setIsSignUp,
    handleEmailAuth,
    toggleSignUp,
    isSubmitting,
  } = useAuthForm({ onSuccess: handleSuccess, logger: authLog, showSuccessOnLogin });

  // Keep ref for handleSuccess to read current isSignUp
  const isSignUpRef = React.useRef(isSignUp);
  isSignUpRef.current = isSignUp;

  // Initialize mode from route params
  React.useEffect(() => {
    setIsSignUp(mode === 'signUp');
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time init from stable route param
  }, []);

  /** Email auth — optionally signOut first (switch-account mode) */
  const handleSubmit = useCallback(async () => {
    if (signOutFirst) {
      try {
        await signOutMutation.mutateAsync();
        storage.remove(LAST_ROOM_CODE_KEY);
        await refreshUser();
      } catch (e: unknown) {
        const raw = e instanceof Error ? e.message : String(e);
        const message = mapAuthError(raw);
        if (isExpectedAuthError(raw)) {
          authLog.warn('Sign-out before switch expected error', { message: raw }, e);
        } else {
          authLog.error('Sign-out before switch failed', { message: raw }, e);
          Sentry.captureException(e);
        }
        showErrorAlert('切换失败', message);
        return;
      }
    }
    await handleEmailAuth();
  }, [signOutFirst, signOutMutation, refreshUser, handleEmailAuth]);

  const handleShowForgotPassword = useCallback(() => {
    navigation.navigate('AuthForgotPassword', { email });
  }, [navigation, email]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Whether to show the "忘记密码?" link
  const showForgotLink = !isSignUp;

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <EmailForm
          formTitle={formTitle}
          isSignUp={isSignUp}
          hideDisplayName={hideDisplayName}
          email={email}
          password={password}
          displayName={displayName}
          authError={authError}
          authLoading={isSubmitting || signOutMutation.isPending}
          onEmailChange={setEmail}
          onPasswordChange={setPassword}
          onDisplayNameChange={setDisplayName}
          onSubmit={() => {
            void handleSubmit();
          }}
          onToggleMode={showToggleMode ? toggleSignUp : undefined}
          onForgotPassword={showForgotLink ? handleShowForgotPassword : undefined}
          onBack={handleBack}
          styles={styles}
          colors={colors}
        />
      </View>
    </View>
  );
};
