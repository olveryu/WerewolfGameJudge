/**
 * LoginOptions - 登录方式选项（Memoized）
 *
 * 显示邮箱登录/匿名登录按钮，通过回调上报选择意图。
 *
 * ✅ 允许：渲染 UI + 上报用户 intent
 * ❌ 禁止：import service / 业务逻辑判断
 */
import React, { memo } from 'react';
import { Text, TouchableOpacity } from 'react-native';

import { TESTIDS } from '@/testids';

import { type HomeScreenStyles } from './styles';

export interface LoginOptionsProps {
  authLoading: boolean;
  onEmailLogin: () => void;
  onAnonymousLogin: () => void;
  onCancel: () => void;
  styles: HomeScreenStyles;
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

export const LoginOptions = memo(LoginOptionsComponent);
