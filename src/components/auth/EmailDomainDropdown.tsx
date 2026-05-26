/**
 * EmailDomainDropdown — email-domain dropdown suggestions
 *
 * While typing an email, shows common domain completions below the input (dropdown list).
 * Tapping an option fills in the full email and auto-advances to the next input.
 * Renders the dropdown UI and reports user selection. Does not import services and contains no business logic.
 */
import { memo, useMemo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { fixed } from '@/theme';

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
          activeOpacity={fixed.activeOpacity}
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
