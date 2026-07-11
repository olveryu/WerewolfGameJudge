/**
 * RoomAuthGate — Login selection shown when a direct room entry needs authentication.
 *
 * Navigates to the AuthLogin modal screen to handle all login/register/forgot-password flows.
 * After login, the auth screen returns and the active game room retries the shared entry controller.
 * No game business logic, no service-layer imports.
 */
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { useAuthContext } from '@/contexts/AuthContext';
import { type RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme';

import { roomEntryStyles as styles } from './roomEntry.styles';

interface RoomAuthGateProps {
  /** Called after successful login (anonymous or email) */
  onSuccess: () => void;
  /** Called when user cancels — typically navigate Home */
  onCancel: () => void;
}

export const RoomAuthGate: React.FC<RoomAuthGateProps> = ({ onSuccess, onCancel }) => {
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
    <View style={styles.authOverlay}>
      <View style={styles.authPanel}>
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
