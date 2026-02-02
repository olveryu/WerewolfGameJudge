/**
 * LoginOptions - Memoized login options component
 *
 * Uses shared styles from parent to avoid redundant StyleSheet.create.
 */
import React, { memo } from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { TESTIDS } from '../../../testids';
import { type HomeScreenStyles } from './styles';

export interface LoginOptionsProps {
  authLoading: boolean;
  onEmailLogin: () => void;
  onAnonymousLogin: () => void;
  onCancel: () => void;
  styles: HomeScreenStyles;
}

function arePropsEqual(prev: LoginOptionsProps, next: LoginOptionsProps): boolean {
  return prev.authLoading === next.authLoading && prev.styles === next.styles;
  // callbacks excluded - use ref pattern
}

const LoginOptionsComponent: React.FC<LoginOptionsProps> = ({
  authLoading,
  onEmailLogin,
  onAnonymousLogin,
  onCancel,
  styles,
}) => {
  return (
    <>
      <Text style={styles.modalTitle}>登录</Text>
      <Text style={styles.modalSubtitle}>选择登录方式继续</Text>

      <TouchableOpacity style={styles.primaryButton} onPress={onEmailLogin} activeOpacity={0.7}>
        <Text style={styles.primaryButtonText}>📧 邮箱登录/注册</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.outlineButton, authLoading && styles.buttonDisabled]}
        onPress={onAnonymousLogin}
        activeOpacity={authLoading ? 1 : 0.7}
        accessibilityState={{ disabled: authLoading }}
        testID={TESTIDS.homeAnonLoginButton}
      >
        <Text style={styles.outlineButtonText}>{authLoading ? '处理中...' : '👤 匿名登录'}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={onCancel} activeOpacity={0.7}>
        <Text style={styles.secondaryButtonText}>取消</Text>
      </TouchableOpacity>
    </>
  );
};

export const LoginOptions = memo(LoginOptionsComponent, arePropsEqual);
