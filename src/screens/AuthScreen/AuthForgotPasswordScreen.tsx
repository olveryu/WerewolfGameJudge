/**
 * AuthForgotPasswordScreen — 忘记密码（输入邮箱发送验证码）
 *
 * 发送成功后 navigate 到 AuthResetPassword。
 * 不含游戏业务逻辑，不 import service 层。
 */
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { toast } from 'sonner-native';

import { ForgotPasswordForm } from '@/components/auth';
import { useAuthContext } from '@/contexts/AuthContext';
import { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme';
import { getErrorMessage } from '@/utils/errorUtils';
import { authLog } from '@/utils/logger';

import { createAuthScreenStyles } from './styles';

type RouteProp = import('@react-navigation/native').RouteProp<
  RootStackParamList,
  'AuthForgotPassword'
>;

export const AuthForgotPasswordScreen: React.FC = () => {
  const { width: screenWidth } = useWindowDimensions();
  const styles = useMemo(() => createAuthScreenStyles(colors, screenWidth), [screenWidth]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'AuthForgotPassword'>>();
  const route = useRoute<RouteProp>();

  const { forgotPassword } = useAuthContext();

  const [email, setEmail] = useState(route.params?.email ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = useCallback(async () => {
    if (loading) return;
    if (!email) {
      toast.warning('请输入邮箱');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await forgotPassword(email);
      toast.success('验证码已发送，请查看邮箱');
      navigation.navigate('AuthResetPassword', { email });
    } catch (e: unknown) {
      const message = getErrorMessage(e);
      authLog.warn('Forgot password failed:', message);
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [email, loading, forgotPassword, navigation]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <ForgotPasswordForm
          email={email}
          authError={error}
          authLoading={loading}
          onEmailChange={setEmail}
          onSubmit={handleSubmit}
          onBack={handleBack}
          styles={styles}
        />
      </View>
    </View>
  );
};
