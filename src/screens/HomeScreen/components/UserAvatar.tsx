/**
 * UserAvatar — TopBar 右侧用户头像按钮
 *
 * 已登录：显示用户头像（Avatar 组件），点击进 Settings。
 * 未登录：显示默认人物 icon，点击进 Settings。
 * 纯展示组件，不 import service，不包含业务逻辑。
 */
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { PressableScale } from '@/components/PressableScale';
import {
  borderRadius,
  colors,
  componentSizes,
  spacing,
  type ThemeColors,
  typography,
  withAlpha,
} from '@/theme';

import { type HomeScreenStyles } from './styles';

interface UserAvatarProps {
  user: { uid: string; avatarUrl?: string | null; isAnonymous?: boolean } | null;
  level?: number | null;
  onPress: () => void;
  styles: HomeScreenStyles;
  colors: ThemeColors;
  testID?: string;
}

/** Circular background wrapper for the avatar in TopBar */
const AVATAR_SIZE = componentSizes.avatar.sm;
const WRAPPER_SIZE = AVATAR_SIZE + spacing.tight * 2;

const BADGE_SIZE = componentSizes.badge.sm;

export const UserAvatar = memo<UserAvatarProps>(
  ({ user, level, onPress, styles: _styles, testID }) => {
    const wrapperStyle = {
      width: WRAPPER_SIZE,
      height: WRAPPER_SIZE,
      borderRadius: borderRadius.full,
      backgroundColor: withAlpha(colors.primary, 0.08),
      alignItems: 'center' as const,
      justifyContent: 'center' as const,
    };

    const badge =
      level != null ? (
        <View style={[badgeStyles.pill, { backgroundColor: colors.primary }]}>
          <Text style={badgeStyles.text}>{level}</Text>
        </View>
      ) : null;

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
            {badge}
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
          {badge}
        </View>
      </PressableScale>
    );
  },
);

const BADGE_TEXT_COLOR = '#fff';

const badgeStyles = StyleSheet.create({
  pill: {
    position: 'absolute',
    bottom: -1,
    right: -2,
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    paddingHorizontal: spacing.micro,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: typography.captionSmall,
    fontWeight: typography.weights.bold,
    color: BADGE_TEXT_COLOR,
  },
});

UserAvatar.displayName = 'UserAvatar';
