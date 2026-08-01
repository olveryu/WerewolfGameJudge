/**
 * RoomMiniProgramAuthFailure — Room-entry login failure inside the WeChat mini-program.
 *
 * Rendered by the room entry boundary when mini-program authentication is unavailable.
 * Provides a "重新进入" button that calls wx.miniProgram.reLaunch to restart the login flow.
 */
import type React from 'react';
import { Text, View } from 'react-native';

import { Button } from '@/components/Button';
import { colors } from '@/theme';

import { roomEntryStyles as styles } from './roomEntry.styles';

interface RoomMiniProgramAuthFailureProps {
  onCancel: () => void;
}

export const RoomMiniProgramAuthFailure: React.FC<RoomMiniProgramAuthFailureProps> = ({
  onCancel,
}) => {
  const handleRelaunch = () => {
    window.wx?.miniProgram?.reLaunch({ url: '/pages/index/index' });
  };

  return (
    <View style={styles.authOverlay}>
      <View style={styles.authPanel}>
        <Text style={styles.authTitle}>微信登录失败</Text>
        <Text style={styles.authSubtitle}>请重新进入小程序以获取新的登录凭证</Text>
        <Button variant="primary" onPress={handleRelaunch}>
          重新进入
        </Button>
        <Button
          variant="ghost"
          buttonColor={colors.background}
          textColor={colors.textSecondary}
          onPress={onCancel}
        >
          返回首页
        </Button>
      </View>
    </View>
  );
};
