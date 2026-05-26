/**
 * ForgotPasswordForm — forgot-password: enter email to send a verification code
 *
 * Auth form component on par with EmailForm. Accepts the unified AuthStyles interface.
 * Renders form UI and reports user intent. Does not import services and contains no business logic.
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
