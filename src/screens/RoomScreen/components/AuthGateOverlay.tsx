/**
 * AuthGateOverlay — 首次通过直连 URL 进入房间时的登录选择界面
 *
 * 导航到 AuthLogin modal screen 处理全部登录/注册/忘记密码流程。
 * 仅当 needsAuth=true 时由 RoomScreen 渲染。
 * 登录成功后 auth screen goBack() → RoomScreen focus → onSuccess()。
 * 不含游戏业务逻辑，不 import service 层。
 */
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { useMemo } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { Button } from '@/components/Button';
import { useAuthContext } from '@/contexts/AuthContext';
import { type RootStackParamList } from '@/navigation/types';
import { createHomeScreenStyles } from '@/screens/HomeScreen/components';
import { colors } from '@/theme';

interface AuthGateOverlayProps {
  /** Called after successful login (anonymous or email) */
  onSuccess: () => void;
  /** Called when user cancels — typically navigate Home */
  onCancel: () => void;
}

export const AuthGateOverlay: React.FC<AuthGateOverlayProps> = ({ onSuccess, onCancel }) => {
  const { width: screenWidth } = useWindowDimensions();
  const styles = useMemo(() => createHomeScreenStyles(colors, screenWidth), [screenWidth]);
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { user } = useAuthContext();

  // Track whether we've navigated to auth screen
  const hasNavigatedRef = useRef(false);

  // Navigate to auth screen on mount
  useEffect(() => {
    if (!hasNavigatedRef.current) {
      hasNavigatedRef.current = true;
      navigation.navigate('AuthLogin', {
        loginTitle: '登录',
        loginSubtitle: '选择登录方式以加入房间',
      });
    }
  }, [navigation]);

  // When user becomes authenticated (auth screen success + goBack), call onSuccess
  useEffect(() => {
    if (user && hasNavigatedRef.current) {
      onSuccess();
    }
  }, [user, onSuccess]);

  // Fallback UI while auth modal is presented (overlay behind the modal)
  return (
    <View style={styles.modalOverlay}>
      <View style={styles.modalContent}>
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
