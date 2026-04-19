/**
 * ResetPasswordForm — 验证码重置密码表单
 *
 * 用户输入邮件中收到的 6 位验证码 + 新密码。成功后自动登录。
 * 与 EmailForm 平级的 auth 表单组件。接收 AuthStyles 统一样式接口。
 * 渲染表单 UI 并上报用户 intent。不 import service，不含业务逻辑。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useCallback, useRef, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { FormTextField } from '@/components/FormTextField';
import { colors, fixed } from '@/theme';
import { type ThemeColors } from '@/theme';

import { type AuthStyles } from './types';

interface ResetPasswordFormProps {
  email: string;
  code: string;
  newPassword: string;
  authError: string | null;
  authLoading: boolean;
  onCodeChange: (text: string) => void;
  onNewPasswordChange: (text: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  onResend: () => void;
  styles: AuthStyles;
  colors: ThemeColors;
}

export const ResetPasswordForm = memo<ResetPasswordFormProps>(
  ({
    email,
    code,
    newPassword,
    authError,
    authLoading,
    onCodeChange,
    onNewPasswordChange,
    onSubmit,
    onBack,
    onResend,
    styles,
  }) => {
    const passwordRef = useRef<TextInput>(null);
    const [showPassword, setShowPassword] = useState(false);
    const [passwordFocused, setPasswordFocused] = useState(false);

    const togglePasswordVisibility = useCallback(() => {
      setShowPassword((prev) => !prev);
    }, []);

    const buttonText = authLoading ? '重置中…' : '重置密码';

    return (
      <View style={styles.formContainer}>
        <Text style={styles.formTitle}>重置密码</Text>
        <Text style={styles.formSubtitle}>验证码已发送至 {email}</Text>

        <FormTextField
          placeholder="6位验证码"
          value={code}
          onChangeText={onCodeChange}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="one-time-code"
          maxLength={6}
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          editable={!authLoading}
        />

        <View style={[styles.passwordWrapper, passwordFocused && styles.passwordWrapperFocused]}>
          <FormTextField
            ref={passwordRef}
            containerStyle={styles.passwordInputContainer}
            style={styles.passwordInput}
            onFocus={() => setPasswordFocused(true)}
            onBlur={() => setPasswordFocused(false)}
            placeholder="新密码（至少6位）"
            value={newPassword}
            onChangeText={onNewPasswordChange}
            secureTextEntry={!showPassword}
            textContentType="newPassword"
            autoComplete="new-password"
            returnKeyType="done"
            onSubmitEditing={onSubmit}
            editable={!authLoading}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={togglePasswordVisibility}
            activeOpacity={fixed.activeOpacity}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {authError && <Text style={styles.errorText}>{authError}</Text>}

        <TouchableOpacity
          style={[styles.primaryButton, authLoading && styles.buttonDisabled]}
          onPress={onSubmit}
          disabled={authLoading}
          activeOpacity={fixed.activeOpacity}
        >
          <Text style={styles.primaryButtonText}>{buttonText}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={onResend} disabled={authLoading}>
          <Text style={styles.linkButtonText}>没收到？重新发送</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>返回登录</Text>
        </TouchableOpacity>
      </View>
    );
  },
);

ResetPasswordForm.displayName = 'ResetPasswordForm';
