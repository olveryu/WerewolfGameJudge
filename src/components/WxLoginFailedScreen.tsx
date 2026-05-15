/**
 * WxLoginFailedScreen — 小程序微信登录失败全屏错误页
 *
 * 在 App 层渲染（替代 splash screen）。
 * 提供 reLaunch 重试（解决网络卡/code 过期），
 * 加兜底文案引导用户重启小程序（解决国际版安全页 strip URL）。
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
      <Button variant="primary" onPress={handleRelaunch}>
        重新进入
      </Button>
      <Text style={styles.hint}>如仍无法登录，请关闭小程序后重新打开</Text>
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
  hint: {
    fontSize: typography.caption,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.small,
  },
});
