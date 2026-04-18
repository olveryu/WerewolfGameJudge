/**
 * AuthLoginScreen — 登录方式选择（Modal Screen）
 *
 * 显示 LoginOptions（邮箱注册/邮箱登录/匿名登录），导航到对应 auth screen。
 * 匿名登录在本 screen 完成后 goBack()。
 * 不含游戏业务逻辑，不 import service 层。
 */
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { toast } from 'sonner-native';

import { LoginOptions } from '@/components/auth';
import { useAuthContext } from '@/contexts/AuthContext';
import { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme';
import { showErrorAlert } from '@/utils/alertPresets';
import { getErrorMessage } from '@/utils/errorUtils';
import { authLog } from '@/utils/logger';
import { hadWxCode, isMiniProgram } from '@/utils/miniProgram';

import { createAuthScreenStyles } from './styles';

type RouteProp = import('@react-navigation/native').RouteProp<RootStackParamList, 'AuthLogin'>;

export const AuthLoginScreen: React.FC = () => {
  const { width: screenWidth } = useWindowDimensions();
  const styles = useMemo(() => createAuthScreenStyles(colors, screenWidth), [screenWidth]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, 'AuthLogin'>>();
  const route = useRoute<RouteProp>();

  const { signInAnonymously, loading: authLoading } = useAuthContext();

  const loginTitle = route.params?.loginTitle ?? '登录';
  const loginSubtitle = route.params?.loginSubtitle;

  const handleEmailSignUp = useCallback(() => {
    navigation.navigate('AuthEmail', {
      mode: 'signUp',
      navigateSettingsOnSignUp: true,
      openedFromAuthLogin: true,
    });
  }, [navigation]);

  const handleEmailSignIn = useCallback(() => {
    navigation.navigate('AuthEmail', { mode: 'signIn', openedFromAuthLogin: true });
  }, [navigation]);

  const handleAnonymousLogin = useCallback(async () => {
    try {
      await signInAnonymously();
      toast.success('登录成功');
      navigation.goBack();
    } catch (e: unknown) {
      const message = getErrorMessage(e);
      authLog.warn('Anonymous login failed:', message);
      showErrorAlert('登录失败', message);
    }
  }, [signInAnonymously, navigation]);

  const handleCancel = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleBrowseAvatars = useCallback(() => {
    navigation.navigate('AvatarPicker');
  }, [navigation]);

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <LoginOptions
          authLoading={authLoading}
          title={loginTitle}
          subtitle={loginSubtitle}
          onEmailSignUp={handleEmailSignUp}
          onEmailSignIn={handleEmailSignIn}
          onAnonymousLogin={handleAnonymousLogin}
          hideAnonymous={isMiniProgram() || hadWxCode()}
          onBrowseAvatars={handleBrowseAvatars}
          onCancel={handleCancel}
          styles={styles}
        />
      </View>
    </View>
  );
};
