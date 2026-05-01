/**
 * WxLoginFailedScreen — 小程序微信登录失败全屏错误页
 *
 * 在 App 层渲染（替代 splash screen），提供"重新进入"按钮
 * 调用 wx.miniProgram.reLaunch 重走登录流程。
 */
import type React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { colors, spacing, typography } from '@/theme';

export const WxLoginFailedScreen: React.FC = () => {
  const handleRelaunch = () => {
    window.wx?.miniProgram?.reLaunch({ url: '/pages/index/index' });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.emoji}>😿</Text>
      <Text style={styles.title}>登录失败</Text>
      <Text style={styles.subtitle}>网络异常，请重新进入小程序</Text>
      <Button variant="primary" onPress={handleRelaunch}>
        重新进入
      </Button>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
    paddingHorizontal: spacing.xlarge,
    gap: spacing.medium,
  },
  emoji: {
    fontSize: typography.display,
  },
  title: {
    fontSize: typography.heading,
    fontWeight: typography.weights.bold,
    color: colors.text,
  },
  subtitle: {
    fontSize: typography.body,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.medium,
  },
});
