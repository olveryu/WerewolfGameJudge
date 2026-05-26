/**
 * ResetPasswordForm - Verification-code password reset form
 *
 * User enters the 6-digit code from email + new password. Auto sign-in on success.
 * Sibling auth form component to EmailForm. Receives the unified AuthStyles style interface.
 * Renders form UI and reports user intent. Does not import service, contains no business logic.
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useCallback, useRef, useState } from 'react';
import { Text, type TextInput, TouchableOpacity, View } from 'react-native';

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
