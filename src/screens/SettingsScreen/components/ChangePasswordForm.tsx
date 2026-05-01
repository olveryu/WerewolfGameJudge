/**
 * ChangePasswordForm — 修改密码内联表单
 *
 * 已登录邮箱用户在 SettingsScreen 中展开使用。
 * 三个字段：旧密码、新密码、确认新密码。客户端校验后调用 changePassword。
 * 使用 FormTextField 统一样式。不含业务逻辑，不 import service 层。
 */
import { memo, useCallback, useRef, useState } from 'react';
import { Text, type TextInput, View } from 'react-native';

import { Button } from '@/components/Button';
import { FormTextField } from '@/components/FormTextField';
import type { ThemeColors } from '@/theme';
import { spacing } from '@/theme';
import { settingsLog } from '@/utils/logger';

import type { SettingsScreenStyles } from './styles';

interface ChangePasswordFormProps {
  onSubmit: (oldPassword: string, newPassword: string) => Promise<void>;
  onCancel: () => void;
  styles: SettingsScreenStyles;
  colors: ThemeColors;
}

export const ChangePasswordForm = memo<ChangePasswordFormProps>(
  ({ onSubmit, onCancel, styles, colors }) => {
    const [oldPassword, setOldPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const newRef = useRef<TextInput>(null);
    const confirmRef = useRef<TextInput>(null);

    const handleSubmit = useCallback(async () => {
      setError(null);

      if (!oldPassword) {
        setError('请输入旧密码');
        return;
      }
      if (!newPassword) {
        setError('请输入新密码');
        return;
      }
      if (newPassword.length < 6) {
        setError('新密码至少 6 个字符');
        return;
      }
      if (newPassword !== confirmPassword) {
        setError('两次输入的新密码不一致');
        return;
      }
      if (oldPassword === newPassword) {
        setError('新密码不能与旧密码相同');
        return;
      }

      setSubmitting(true);
      try {
        await onSubmit(oldPassword, newPassword);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : String(e);
        settingsLog.warn('changePassword failed', { error: msg });
        setError(msg);
      } finally {
        setSubmitting(false);
      }
    }, [oldPassword, newPassword, confirmPassword, onSubmit]);

    return (
      <View style={{ gap: spacing.small }}>
        <FormTextField
          placeholder="旧密码"
          secureTextEntry
          autoComplete="current-password"
          value={oldPassword}
          onChangeText={setOldPassword}
          returnKeyType="next"
          onSubmitEditing={() => newRef.current?.focus()}
          editable={!submitting}
        />
        <FormTextField
          ref={newRef}
          placeholder="新密码（至少 6 位）"
          secureTextEntry
          autoComplete="new-password"
          value={newPassword}
          onChangeText={setNewPassword}
          returnKeyType="next"
          onSubmitEditing={() => confirmRef.current?.focus()}
          editable={!submitting}
        />
        <FormTextField
          ref={confirmRef}
          placeholder="确认新密码"
          secureTextEntry
          autoComplete="new-password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          returnKeyType="done"
          onSubmitEditing={() => {
            void handleSubmit();
          }}
          editable={!submitting}
        />
        {error && <Text style={styles.errorText}>{error}</Text>}
        <Button
          variant="primary"
          onPress={() => {
            void handleSubmit();
          }}
          disabled={submitting}
          buttonColor={colors.primary}
          textColor={colors.textInverse}
        >
          {submitting ? '修改中' : '确认修改'}
        </Button>
        <Button
          variant="ghost"
          onPress={onCancel}
          disabled={submitting}
          buttonColor={colors.background}
          textColor={colors.textSecondary}
        >
          取消
        </Button>
      </View>
    );
  },
);

ChangePasswordForm.displayName = 'ChangePasswordForm';
