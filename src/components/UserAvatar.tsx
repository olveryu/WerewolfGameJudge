/**
 * UserAvatar — 用户头像按钮（含抽奖券 badge）
 *
 * 已登录：显示用户头像（Avatar 组件），点击进 Settings。
 * 未登录：显示默认人物 icon，点击进 Settings。
 * 纯展示组件，不 import service，不包含业务逻辑。
 * HomeScreen TopBar 和 RoomScreen HeaderActions 共用。
 */
import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { PressableScale } from '@/components/PressableScale';
import { borderRadius, colors, componentSizes, spacing, typography, withAlpha } from '@/theme';

interface UserAvatarProps {
  user: { uid: string; avatarUrl?: string | null } | null;
  ticketCount?: number | null;
  onPress: () => void;
  testID?: string;
}

const AVATAR_SIZE = componentSizes.avatar.sm;
const WRAPPER_SIZE = AVATAR_SIZE + spacing.tight * 2;
const BADGE_SIZE = componentSizes.badge.sm;

export const UserAvatar = memo<UserAvatarProps>(({ user, ticketCount, onPress, testID }) => {
  const showBadge = ticketCount != null && ticketCount > 0;
  const badgeLabel = ticketCount != null && ticketCount > 99 ? '99+' : String(ticketCount ?? 0);
  const badge = showBadge ? (
    <View style={badgeStyles.pill}>
      <Text style={badgeStyles.text}>{badgeLabel}</Text>
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
});

const wrapperStyle = {
  width: WRAPPER_SIZE,
  height: WRAPPER_SIZE,
  borderRadius: borderRadius.full,
  backgroundColor: withAlpha(colors.primary, 0.08),
  alignItems: 'center' as const,
  justifyContent: 'center' as const,
};

const badgeStyles = StyleSheet.create({
  pill: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: BADGE_SIZE,
    height: BADGE_SIZE,
    borderRadius: BADGE_SIZE / 2,
    paddingHorizontal: spacing.micro,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  text: {
    fontSize: typography.captionSmall,
    fontWeight: typography.weights.bold,
    color: colors.textInverse,
  },
});

UserAvatar.displayName = 'UserAvatar';
