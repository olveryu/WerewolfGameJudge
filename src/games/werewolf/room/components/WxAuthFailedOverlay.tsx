/**
 * WxAuthFailedOverlay — Login failure overlay inside the WeChat mini-program
 *
 * Only renders when isMiniProgram() + needsAuth is true.
 * Provides a "重新进入" button that calls wx.miniProgram.reLaunch to restart the login flow.
 */
import type React from 'react';
import { useMemo } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/Button';
import { createHomeScreenStyles } from '@/screens/HomeScreen/components';
import { colors } from '@/theme';

interface WxAuthFailedOverlayProps {
  onCancel: () => void;
}

export const WxAuthFailedOverlay: React.FC<WxAuthFailedOverlayProps> = ({ onCancel }) => {
  const { width: screenWidth } = useWindowDimensions();
  const styles = useMemo(() => createHomeScreenStyles(colors, screenWidth), [screenWidth]);

  const handleRelaunch = () => {
    window.wx?.miniProgram?.reLaunch({ url: '/pages/index/index' });
  };

  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
        <Text style={styles.modalTitle}>微信登录失败</Text>
        <Text style={styles.modalSubtitle}>请重新进入小程序以获取新的登录凭证</Text>
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
