/**
 * RoomAuthGate — Login selection shown when a direct room entry needs authentication.
 *
 * Rendered by `RoomResolverScreen` while there is no session. Navigates to the AuthLogin modal screen
 * to handle all login/register/forgot-password flows; once the auth context has a user, the resolver
 * stops rendering this gate and performs the room lookup.
 * No game business logic, no service-layer imports.
 */
import { useNavigation } from '@react-navigation/native';
import { type NativeStackNavigationProp } from '@react-navigation/native-stack';
import type React from 'react';
import { useEffect, useRef } from 'react';
import { View } from 'react-native';

import { Button } from '@/components/Button';
import { type RootStackParamList } from '@/navigation/types';
import { colors } from '@/theme';

import { roomEntryStyles as styles } from './roomEntry.styles';

interface RoomAuthGateProps {
  /** Called when user cancels — typically navigate Home */
  onCancel: () => void;
}

export const RoomAuthGate: React.FC<RoomAuthGateProps> = ({ onCancel }) => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

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
