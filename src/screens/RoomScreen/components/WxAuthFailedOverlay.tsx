/**
 * WxAuthFailedOverlay — 微信小程序内登录失败时的提示界面
 *
 * 仅在 isMiniProgram() + needsAuth 时渲染。
 * 提供"重新进入"按钮，调用 wx.miniProgram.reLaunch 重走登录流程。
 */
import React, { useMemo } from 'react';
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
