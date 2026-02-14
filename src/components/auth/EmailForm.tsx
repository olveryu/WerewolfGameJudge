/**
 * EmailForm — 邮箱登录/注册表单（共享组件）
 *
 * Home 和 Settings 共用。接收 AuthStyles 统一样式接口。
 * 包含 autocomplete / keyboard 增强 / 邮箱域名下拉。
 *
 * ✅ 允许：渲染 UI + 上报用户 intent
 * ❌ 禁止：import service / 业务逻辑判断
 */
import { Ionicons } from '@expo/vector-icons';
import { memo, useCallback, useMemo, useRef, useState } from 'react';
import { Text, TextInput, TouchableOpacity, View } from 'react-native';

import { EmailDomainDropdown } from './EmailDomainDropdown';
import { type EmailFormProps } from './types';

export const EmailForm = memo<EmailFormProps>(
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
    onBack,
    styles,
    colors,
  }) => {
    const passwordRef = useRef<TextInput>(null);
    const nameRef = useRef<TextInput>(null);
    const [showPassword, setShowPassword] = useState(false);

    const togglePasswordVisibility = useCallback(() => {
      setShowPassword((prev) => !prev);
    }, []);

    const buttonText = useMemo(() => {
      if (authLoading) return '处理中...';
      return isSignUp ? '注册' : '登录';
    }, [authLoading, isSignUp]);

    const handleDomainSelect = useCallback(
      (fullEmail: string) => {
        onEmailChange(fullEmail);
        passwordRef.current?.focus();
      },
      [onEmailChange],
    );

    return (
      <View style={styles.formContainer}>
        <Text style={styles.formTitle}>{isSignUp ? '注册账号' : '邮箱登录'}</Text>

        <TextInput
          style={styles.input}
          placeholder="邮箱"
          placeholderTextColor={colors.textSecondary}
          value={email}
          onChangeText={onEmailChange}
          keyboardType="email-address"
          autoCapitalize="none"
          textContentType="emailAddress"
          autoComplete="email"
          returnKeyType="next"
          onSubmitEditing={() => passwordRef.current?.focus()}
          editable={!authLoading}
        />

        <EmailDomainDropdown email={email} onSelect={handleDomainSelect} styles={styles} />

        <View style={styles.passwordWrapper}>
          <TextInput
            ref={passwordRef}
            style={[styles.input, { marginBottom: 0, flex: 1 }]}
            placeholder="密码"
            placeholderTextColor={colors.textSecondary}
            value={password}
            onChangeText={onPasswordChange}
            secureTextEntry={!showPassword}
            textContentType={isSignUp ? 'newPassword' : 'password'}
            autoComplete={isSignUp ? 'new-password' : 'password'}
            returnKeyType={isSignUp ? 'next' : 'done'}
            onSubmitEditing={() => (isSignUp ? nameRef.current?.focus() : onSubmit())}
            editable={!authLoading}
          />
          <TouchableOpacity
            style={styles.eyeButton}
            onPress={togglePasswordVisibility}
            activeOpacity={0.6}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Ionicons
              name={showPassword ? 'eye-off-outline' : 'eye-outline'}
              size={20}
              color={colors.textSecondary}
            />
          </TouchableOpacity>
        </View>

        {isSignUp && (
          <TextInput
            ref={nameRef}
            style={styles.input}
            placeholder="昵称（可选）"
            placeholderTextColor={colors.textSecondary}
            value={displayName}
            onChangeText={onDisplayNameChange}
            textContentType="name"
            autoComplete="name"
            returnKeyType="done"
            onSubmitEditing={onSubmit}
            editable={!authLoading}
          />
        )}

        {authError && <Text style={styles.errorText}>{authError}</Text>}

        <TouchableOpacity
          style={[styles.primaryButton, authLoading && styles.buttonDisabled]}
          onPress={onSubmit}
          disabled={authLoading}
          activeOpacity={0.7}
        >
          <Text style={styles.primaryButtonText}>{buttonText}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.linkButton} onPress={onToggleMode}>
          <Text style={styles.linkButtonText}>
            {isSignUp ? '已有账号？去登录' : '没有账号？去注册'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryButton} onPress={onBack}>
          <Text style={styles.secondaryButtonText}>返回</Text>
        </TouchableOpacity>
      </View>
    );
  },
);

EmailForm.displayName = 'EmailForm';
