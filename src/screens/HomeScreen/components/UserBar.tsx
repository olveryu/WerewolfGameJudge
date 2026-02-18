/**
 * UserBar - 用户信息栏（Memoized）
 *
 * 显示头像 + 昵称 + 注销按钮，通过回调上报操作意图。
 * 渲染 UI 并上报用户 intent，不 import service，不包含业务逻辑判断。
 */
import React, { memo, useCallback } from 'react';
import { Text, TouchableOpacity, View } from 'react-native';

import { Avatar } from '@/components/Avatar';
import { TESTIDS } from '@/testids';
import { showAlert } from '@/utils/alert';

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

export const UserBar = memo(UserBarComponent);
