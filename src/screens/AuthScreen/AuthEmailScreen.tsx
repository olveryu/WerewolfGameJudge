/**
 * AuthEmailScreen — email login / signup form (Modal Screen)
 *
 * Receives route params (mode / formTitle / signOutFirst / showToggleMode, etc.).
 * On login/signup success, goBack() to caller screen; caller responds to state via auth context.
 * When signUp and navigateSettingsOnSignUp=true, replaces to Settings.
 * No game business logic; does not import service layer (except signOut).
 */
import { useNavigation, useRoute } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { EmailForm } from '@/components/auth';
import { useAuthContext } from '@/contexts/AuthContext';
import { useSignOut } from '@/hooks/mutations/useAuthMutations';
import { useAuthForm } from '@/hooks/useAuthForm';
import { clearRecentRooms } from '@/lib/recentRooms';
import { type RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme';
import { showErrorAlert } from '@/utils/alertPresets';
import { handleError } from '@/utils/errorPipeline';
import { getUserFacingMessage, isExpectedError } from '@/utils/errorUtils';
import { authLog } from '@/utils/logger';

import { createAuthScreenStyles } from './AuthScreen.styles';

type RouteProp = import('@react-navigation/native').RouteProp<RootStackParamList, 'AuthEmail'>;

/** Email auth screen. */
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
  const { mutateAsync: signOut, isPending: isSignOutPending } = useSignOut();

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
        await signOut();
        clearRecentRooms();
        await refreshUser();
      } catch (e: unknown) {
        handleError(e, {
          label: '切换账号',
          logger: authLog,
          feedback: false,
          isExpected: isExpectedError,
        });
        showErrorAlert('切换失败', getUserFacingMessage(e));
        return;
      }
    }
    await handleEmailAuth();
  }, [signOutFirst, signOut, refreshUser, handleEmailAuth]);

  const handleShowForgotPassword = useCallback(() => {
    navigation.navigate('AuthForgotPassword', { email });
  }, [navigation, email]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  // Whether to show the "forgot password" link
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
          authLoading={isSubmitting || isSignOutPending}
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
