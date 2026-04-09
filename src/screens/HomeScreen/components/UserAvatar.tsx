/**
 * UserAvatar — TopBar 右侧用户头像按钮
 *
 * 已登录：显示用户头像（Avatar 组件），点击进 Settings。
 * 未登录：显示默认人物 icon，点击进 Settings。
 * 纯展示组件，不 import service，不包含业务逻辑。
 */
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { PressableScale } from '@/components/PressableScale';
import { borderRadius, componentSizes, spacing, type ThemeColors, withAlpha } from '@/theme';

import { type HomeScreenStyles } from './styles';

interface UserAvatarProps {
  user: { uid: string; avatarUrl?: string | null; isAnonymous?: boolean } | null;
  onPress: () => void;
  styles: HomeScreenStyles;
  colors: ThemeColors;
  testID?: string;
}

/** Circular background wrapper for the avatar in TopBar */
const AVATAR_SIZE = componentSizes.avatar.sm;
const WRAPPER_SIZE = AVATAR_SIZE + spacing.tight * 2;

export const UserAvatar = memo<UserAvatarProps>(
  ({ user, onPress, styles: _styles, colors, testID }) => {
    const wrapperStyle = {
      width: WRAPPER_SIZE,
      height: WRAPPER_SIZE,
      borderRadius: borderRadius.full,
      backgroundColor: withAlpha(colors.primary, 0.08),
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    };

    if (user) {
      return (
        <PressableScale onPress={onPress} accessibilityLabel="设置" testID={testID}>
          <View style={wrapperStyle}>
            <Avatar
              value={user.uid}
              size={AVATAR_SIZE}
              avatarUrl={user.avatarUrl}
              borderRadius={AVATAR_SIZE / 2}
            />
          </View>
        </PressableScale>
      );
    }

    return (
      <PressableScale onPress={onPress} accessibilityLabel="设置" testID={testID}>
        <View style={wrapperStyle}>
          <Ionicons
            name="person-circle-outline"
            size={componentSizes.icon.md}
            color={colors.textSecondary}
          />
        </View>
      </PressableScale>
    );
  },
);

UserAvatar.displayName = 'UserAvatar';
