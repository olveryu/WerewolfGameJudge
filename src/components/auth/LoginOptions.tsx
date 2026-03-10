/**
 * LoginOptions — 登录方式选择（共享组件）
 *
 * Home 和 Settings 共用。显示邮箱登录 / 匿名登录按钮。
 * 渲染登录方式 UI 并上报用户选择。不 import service，不含业务逻辑。
 */
import { memo } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { UI } from '@/config/emojiTokens';
import { TESTIDS } from '@/testids';
import { fixed } from '@/theme/tokens';

import { type LoginOptionsProps } from './types';

export const LoginOptions = memo<LoginOptionsProps>(
  ({ authLoading, title, subtitle, onEmailLogin, onAnonymousLogin, onCancel, styles }) => {
    return (
      <View style={styles.formContainer}>
        {title != null && <Text style={styles.formTitle}>{title}</Text>}
        {subtitle != null && <Text style={styles.formSubtitle}>{subtitle}</Text>}

        <TouchableOpacity
          style={styles.primaryButton}
          onPress={onEmailLogin}
          activeOpacity={fixed.activeOpacity}
        >
          <Text style={styles.primaryButtonText}>{UI.EMAIL} 邮箱登录/注册</Text>
          <Text style={styles.buttonCaptionInverse}>可自定义头像和昵称</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.outlineButton, authLoading && styles.buttonDisabled]}
          onPress={onAnonymousLogin}
          disabled={authLoading}
          activeOpacity={fixed.activeOpacity}
          testID={TESTIDS.homeAnonLoginButton}
        >
          <Text style={styles.outlineButtonText}>
            {authLoading ? '处理中...' : `${UI.USER} 匿名登录`}
          </Text>
          {!authLoading && <Text style={styles.buttonCaption}>随机分配头像和昵称</Text>}
        </TouchableOpacity>

        {onCancel != null && (
          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={onCancel}
            activeOpacity={fixed.activeOpacity}
          >
            <Text style={styles.secondaryButtonText}>取消</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  },
);

LoginOptions.displayName = 'LoginOptions';
