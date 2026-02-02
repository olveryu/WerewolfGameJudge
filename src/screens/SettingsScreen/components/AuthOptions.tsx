/**
 * AuthOptions - Memoized login options component
 *
 * Performance: Receives pre-created styles from parent.
 */
import React, { memo } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { SettingsScreenStyles } from './styles';

export interface AuthOptionsProps {
  authLoading: boolean;
  onShowForm: () => void;
  onAnonymousLogin: () => void;
  styles: SettingsScreenStyles;
}

const arePropsEqual = (prev: AuthOptionsProps, next: AuthOptionsProps): boolean => {
  return prev.authLoading === next.authLoading && prev.styles === next.styles;
  // onXxx callbacks excluded - stable via useCallback
};

export const AuthOptions = memo<AuthOptionsProps>(
  ({ authLoading, onShowForm, onAnonymousLogin, styles }) => {
    return (
      <View style={styles.authOptions}>
        <TouchableOpacity style={styles.authOptionBtn} onPress={onShowForm}>
          <Text style={styles.authOptionIcon}>📧</Text>
          <Text style={styles.authOptionText}>邮箱登录/注册</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.authOptionBtn,
            styles.authOptionBtnSecondary,
            authLoading && { opacity: 0.5 },
          ]}
          onPress={onAnonymousLogin}
          activeOpacity={authLoading ? 1 : 0.7}
          accessibilityState={{ disabled: authLoading }}
        >
          <Text style={styles.authOptionIcon}>👤</Text>
          <Text style={styles.authOptionTextSecondary}>
            {authLoading ? '处理中...' : '匿名登录'}
          </Text>
        </TouchableOpacity>
      </View>
    );
  },
  arePropsEqual,
);

AuthOptions.displayName = 'AuthOptions';
