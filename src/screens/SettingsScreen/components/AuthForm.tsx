/**
 * AuthForm - 邮箱认证表单组件（Memoized）
 *
 * 接收父组件 styles，通过回调上报输入和提交意图。
 *
 * ✅ 允许：渲染 UI + 上报用户 intent
 * ❌ 禁止：import service / 业务逻辑判断
 */
import React, { memo, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput } from 'react-native';
import { ThemeColors } from '@/theme';
import { SettingsScreenStyles } from './styles';

export interface AuthFormProps {
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
  onCancel: () => void;
  styles: SettingsScreenStyles;
  colors: ThemeColors;
}

const arePropsEqual = (prev: AuthFormProps, next: AuthFormProps): boolean => {
  return (
    prev.isSignUp === next.isSignUp &&
    prev.email === next.email &&
    prev.password === next.password &&
    prev.displayName === next.displayName &&
    prev.authError === next.authError &&
    prev.authLoading === next.authLoading &&
    prev.styles === next.styles
    // onXxx callbacks excluded - stable via useCallback
  );
};

export const AuthForm = memo<AuthFormProps>(
  ({
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
    onCancel,
    styles,
    colors,
  }) => {
    const buttonText = useMemo(() => {
      if (authLoading) return '处理中...';
      return isSignUp ? '注册' : '登录';
    }, [authLoading, isSignUp]);

    return (
      <View style={styles.authForm}>
        <Text style={styles.authTitle}>{isSignUp ? '注册账号' : '邮箱登录'}</Text>

        <TextInput
          style={styles.input}
          placeholder="邮箱"
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={onEmailChange}
          keyboardType="email-address"
          autoCapitalize="none"
        />

        <TextInput
          style={styles.input}
          placeholder="密码"
          placeholderTextColor={colors.textSecondary}
          value={password}
          onChangeText={onPasswordChange}
          secureTextEntry
        />

        {isSignUp && (
          <TextInput
            style={styles.input}
            placeholder="昵称（可选）"
            placeholderTextColor={colors.textSecondary}
            value={displayName}
            onChangeText={onDisplayNameChange}
          />
        )}

        {authError && <Text style={styles.errorText}>{authError}</Text>}

        <TouchableOpacity
          style={[styles.authBtn, authLoading && styles.authBtnDisabled]}
          onPress={onSubmit}
          activeOpacity={authLoading ? 1 : 0.7}
          accessibilityState={{ disabled: authLoading }}
        >
          <Text style={styles.authBtnText}>{buttonText}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.switchAuthBtn} onPress={onToggleMode}>
          <Text style={styles.switchAuthText}>
            {isSignUp ? '已有账号？去登录' : '没有账号？去注册'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelAuthBtn} onPress={onCancel}>
          <Text style={styles.cancelAuthText}>取消</Text>
        </TouchableOpacity>
      </View>
    );
  },
  arePropsEqual,
);

AuthForm.displayName = 'AuthForm';
