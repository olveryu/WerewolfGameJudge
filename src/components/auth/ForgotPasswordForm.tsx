/**
 * ForgotPasswordForm — 忘记密码：输入邮箱发送验证码
 *
 * 与 EmailForm 平级的 auth 表单组件。接收 AuthStyles 统一样式接口。
 * 渲染表单 UI 并上报用户 intent。不 import service，不含业务逻辑。
 */
import { memo, useCallback, useRef } from 'react';
import { Text, type TextInput, TouchableOpacity, View } from 'react-native';

import { FormTextField } from '@/components/FormTextField';
import { fixed } from '@/theme';

import { EmailDomainDropdown } from './EmailDomainDropdown';
import { type AuthStyles } from './types';

interface ForgotPasswordFormProps {
  email: string;
  authError: string | null;
  authLoading: boolean;
  onEmailChange: (text: string) => void;
  onSubmit: () => void;
  onBack: () => void;
  styles: AuthStyles;
}

export const ForgotPasswordForm = memo<ForgotPasswordFormProps>(
  ({ email, authError, authLoading, onEmailChange, onSubmit, onBack, styles }) => {
    const emailRef = useRef<TextInput>(null);

    const handleDomainSelect = useCallback(
      (fullEmail: string) => {
        onEmailChange(fullEmail);
      },
      [onEmailChange],
    );

    const buttonText = authLoading ? '发送中…' : '发送验证码';

    return (
      <View style={styles.formContainer}>
        <Text style={styles.formTitle}>忘记密码</Text>
        <Text style={styles.formSubtitle}>输入注册邮箱，我们将发送验证码</Text>

        <FormTextField
          ref={emailRef}
          placeholder="邮箱"
          value={email}
          onChangeText={onEmailChange}
          keyboardType="email-address"
          autoCapitalize="none"
          textContentType="emailAddress"
          autoComplete="email"
          returnKeyType="done"
          onSubmitEditing={onSubmit}
          editable={!authLoading}
        />

        <EmailDomainDropdown email={email} onSelect={handleDomainSelect} styles={styles} />

        {authError && <Text style={styles.errorText}>{authError}</Text>}

        <TouchableOpacity
          style={[styles.primaryButton, authLoading && styles.buttonDisabled]}
          onPress={onSubmit}
          disabled={authLoading}
          activeOpacity={fixed.activeOpacity}
        >
          <Text style={styles.primaryButtonText}>{buttonText}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>返回登录</Text>
        </TouchableOpacity>
      </View>
    );
  },
);

ForgotPasswordForm.displayName = 'ForgotPasswordForm';
