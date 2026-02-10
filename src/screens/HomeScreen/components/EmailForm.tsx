/**
 * EmailForm - 邮箱登录表单（Memoized）
 *
 * 接收父组件 styles，通过回调上报输入和提交意图。
 *
 * ✅ 允许：渲染 UI + 上报用户 intent
 * ❌ 禁止：import service / 业务逻辑判断
 */
import React, { memo, useCallback } from 'react';
import { Text, TextInput, TouchableOpacity } from 'react-native';

import { type ThemeColors } from '@/theme';

import { type HomeScreenStyles } from './styles';

export interface EmailFormProps {
  isSignUp: boolean;
  email: string;
  password: string;
  displayName: string;
  authError: string | null;
  authLoading: boolean;
  onEmailChange: (text: string) => void;
  onPasswordChange: (text: string) => void;
  onDisplayNameChange: (text: string) => void;
  onSubmit: () => void;
  onToggleMode: () => void;
  onBack: () => void;
  styles: HomeScreenStyles;
  colors: ThemeColors;
}

const EmailFormComponent: React.FC<EmailFormProps> = ({
  isSignUp,
  email,
  password,
  displayName,
  authError,
  authLoading,
  onEmailChange,
  onPasswordChange,
  onDisplayNameChange,
  onSubmit,
  onToggleMode,
  onBack,
  styles,
  colors,
}) => {
  const getButtonText = useCallback(() => {
    if (authLoading) return '处理中...';
    return isSignUp ? '注册' : '登录';
  }, [authLoading, isSignUp]);

  return (
    <>
      <Text style={styles.modalTitle}>{isSignUp ? '注册账号' : '邮箱登录'}</Text>

      <TextInput
        style={styles.input}
        placeholder="邮箱"
        placeholderTextColor={colors.textMuted}
        value={email}
        onChangeText={onEmailChange}
        keyboardType="email-address"
        autoCapitalize="none"
      />

      <TextInput
        style={styles.input}
        placeholder="密码"
        placeholderTextColor={colors.textMuted}
        value={password}
        onChangeText={onPasswordChange}
        secureTextEntry
      />

      {isSignUp && (
        <TextInput
          style={styles.input}
          placeholder="昵称（可选）"
          placeholderTextColor={colors.textMuted}
          value={displayName}
          onChangeText={onDisplayNameChange}
        />
      )}

      {authError && <Text style={styles.errorText}>{authError}</Text>}

      <TouchableOpacity
        style={[styles.primaryButton, authLoading && styles.buttonDisabled]}
        onPress={onSubmit}
        activeOpacity={authLoading ? 1 : 0.7}
        accessibilityState={{ disabled: authLoading }}
      >
        <Text style={styles.primaryButtonText}>{getButtonText()}</Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.linkButton} onPress={onToggleMode}>
        <Text style={styles.linkButtonText}>
          {isSignUp ? '已有账号？去登录' : '没有账号？去注册'}
        </Text>
      </TouchableOpacity>

      <TouchableOpacity style={styles.secondaryButton} onPress={onBack}>
        <Text style={styles.secondaryButtonText}>返回</Text>
      </TouchableOpacity>
    </>
  );
};

export const EmailForm = memo(EmailFormComponent);
