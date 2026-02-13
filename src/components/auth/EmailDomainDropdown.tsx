/**
 * EmailDomainDropdown — 邮箱域名下拉建议
 *
 * 输入邮箱时，在输入框下方显示常见域名补全项（dropdown 列表）。
 * 点选后填入完整邮箱并自动跳到下一个输入框。
 *
 * ✅ 允许：渲染 UI + 上报选择
 * ❌ 禁止：import service / 业务逻辑
 */
import { memo, useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { type AuthStyles } from './types';

const EMAIL_DOMAINS = ['@qq.com', '@163.com', '@gmail.com', '@icloud.com', '@outlook.com'];

interface EmailDomainDropdownProps {
  email: string;
  onSelect: (fullEmail: string) => void;
  styles: AuthStyles;
}

export const EmailDomainDropdown = memo<EmailDomainDropdownProps>(({ email, onSelect, styles }) => {
  // Show when: has content, no complete domain yet
  const visible = useMemo(() => {
    if (!email) return false;
    const atIndex = email.indexOf('@');
    if (atIndex === -1) return true;
    return !email.slice(atIndex).includes('.');
  }, [email]);

  const localPart = useMemo(() => email.split('@')[0], [email]);

  if (!visible) return null;

  return (
    <View style={styles.emailDomainDropdown}>
      {EMAIL_DOMAINS.map((domain) => (
        <TouchableOpacity
          key={domain}
          style={styles.emailDomainItem}
          onPress={() => onSelect(localPart + domain)}
          activeOpacity={0.7}
        >
          <Text style={styles.emailDomainText} numberOfLines={1}>
            {localPart + domain}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
});

EmailDomainDropdown.displayName = 'EmailDomainDropdown';
