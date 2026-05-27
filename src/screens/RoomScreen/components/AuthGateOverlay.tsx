/**
 * AuthGateOverlay — Login selection overlay shown when entering a room via direct URL for the first time
 *
 * Navigates to the AuthLogin modal screen to handle all login/register/forgot-password flows.
 * Only rendered by RoomScreen when needsAuth=true.
 * After login, auth screen goBack() → RoomScreen focus → onSuccess().
 * No game business logic, no service-layer imports.
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
