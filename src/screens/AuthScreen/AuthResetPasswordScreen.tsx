/**
 * AuthResetPasswordScreen — 验证码重置密码
 *
 * 用户输入 6 位验证码 + 新密码。成功后自动登录并 popToTop() 关闭整个 auth 流。
 * 不含游戏业务逻辑，不 import service 层。
 */
import { useNavigation, useRoute } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useMemo, useState } from 'react';
import { useWindowDimensions, View } from 'react-native';
import { toast } from 'sonner-native';

import { ResetPasswordForm } from '@/components/auth';
import { useAuthContext } from '@/contexts/AuthContext';
import { useForgotPassword, useResetPassword } from '@/hooks/mutations/useAuthMutations';
import { RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme';
import { getErrorMessage } from '@/utils/errorUtils';
import { authLog } from '@/utils/logger';

import { createAuthScreenStyles } from './AuthScreen.styles';

type RouteProp = import('@react-navigation/native').RouteProp<
  RootStackParamList,
  'AuthResetPassword'
>;

export const AuthResetPasswordScreen: React.FC = () => {
  const { width: screenWidth } = useWindowDimensions();
  const styles = useMemo(() => createAuthScreenStyles(colors, screenWidth), [screenWidth]);
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList, 'AuthResetPassword'>>();
  const route = useRoute<RouteProp>();

  const { email } = route.params;
  const { refreshUser } = useAuthContext();
  const resetPasswordMutation = useResetPassword();
  const forgotPasswordMutation = useForgotPassword();

  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isLoading = resetPasswordMutation.isPending || forgotPasswordMutation.isPending;

  const handleSubmit = useCallback(async () => {
    if (!code || !newPassword) {
      toast.warning('请输入验证码和新密码');
      return;
    }
    if (newPassword.length < 6) {
      toast.warning('密码至少6位');
      return;
    }
    setError(null);
    try {
      await resetPasswordMutation.mutateAsync({ email, code, newPassword });
      await refreshUser();
      toast.success('密码重置成功');
      // Pop all auth modal screens back to the original caller
      navigation.popToTop();
    } catch (e: unknown) {
      const message = getErrorMessage(e);
      authLog.warn('Reset password failed:', message);
      setError(message);
    }
  }, [email, code, newPassword, resetPasswordMutation, refreshUser, navigation]);

  const handleResend = useCallback(async () => {
    setError(null);
    try {
      await forgotPasswordMutation.mutateAsync(email);
      toast.success('验证码已重新发送');
    } catch (e: unknown) {
      const message = getErrorMessage(e);
      setError(message);
    }
  }, [email, forgotPasswordMutation]);

  const handleBack = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <ResetPasswordForm
          email={email}
          code={code}
          newPassword={newPassword}
          authError={error}
          authLoading={isLoading}
          onCodeChange={setCode}
          onNewPasswordChange={setNewPassword}
          onSubmit={() => {
            void handleSubmit();
          }}
          onResend={() => {
            void handleResend();
          }}
          onBack={handleBack}
          styles={styles}
          colors={colors}
        />
      </View>
    </View>
  );
};
