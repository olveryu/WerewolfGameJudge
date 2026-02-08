/**
 * UserBar - 用户信息栏（Memoized）
 *
 * 显示头像 + 昵称 + 注销按钮，通过回调上报操作意图。
 *
 * ✅ 允许：渲染 UI + 上报用户 intent
 * ❌ 禁止：import service / 业务逻辑判断
 */
import React, { memo, useCallback } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import Avatar from '@/components/Avatar';
import { showAlert } from '@/utils/alert';
import { TESTIDS } from '@/testids';
import { type HomeScreenStyles } from './styles';

interface User {
  uid: string;
  isAnonymous: boolean;
  displayName?: string | null;
  email?: string | null;
  avatarUrl?: string | null;
}

export interface UserBarProps {
  user: User | null;
  userName: string;
  onLogin: () => void;
  onSignOut: () => void;
  styles: HomeScreenStyles;
}

function arePropsEqual(prev: UserBarProps, next: UserBarProps): boolean {
  return (
    prev.user?.uid === next.user?.uid &&
    prev.user?.isAnonymous === next.user?.isAnonymous &&
    prev.user?.avatarUrl === next.user?.avatarUrl &&
    prev.userName === next.userName &&
    prev.styles === next.styles
    // callbacks excluded - use ref pattern
  );
}

const UserBarComponent: React.FC<UserBarProps> = ({
  user,
  userName,
  onLogin,
  onSignOut,
  styles,
}) => {
  const handlePress = useCallback(() => {
    if (user) {
      showAlert(userName, user.isAnonymous ? '匿名登录用户' : user.email || '已登录', [
        { text: '取消', style: 'cancel' },
        {
          text: '退出登录',
          style: 'destructive',
          onPress: onSignOut,
        },
      ]);
    } else {
      onLogin();
    }
  }, [user, userName, onLogin, onSignOut]);

  return (
    <TouchableOpacity
      style={styles.userBar}
      testID={TESTIDS.homeUserBar}
      onPress={handlePress}
      activeOpacity={0.8}
    >
      {!user && (
        <>
          <View style={styles.userAvatarPlaceholder}>
            <Text style={styles.userAvatarIcon}>👤</Text>
          </View>
          <Text style={styles.userNameText} testID={TESTIDS.homeLoginButton}>
            点击登录
          </Text>
        </>
      )}
      {user && user.isAnonymous && (
        <>
          <View style={styles.userAvatarPlaceholder}>
            <Text style={styles.userAvatarIcon}>👤</Text>
          </View>
          <Text style={styles.userNameText} testID={TESTIDS.homeUserName}>
            {userName}
          </Text>
        </>
      )}
      {user && !user.isAnonymous && (
        <>
          <Avatar value={user.uid} size={36} avatarUrl={user.avatarUrl} />
          <Text style={styles.userNameText} testID={TESTIDS.homeUserName}>
            {userName}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

export const UserBar = memo(UserBarComponent, arePropsEqual);
