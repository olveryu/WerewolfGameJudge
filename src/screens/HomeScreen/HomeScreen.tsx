/**
 * HomeScreen - 主页入口（登录、加入房间、创建房间）
 *
 * 性能优化：styles factory 集中创建一次，通过 props 传入子组件；handlers 用 useCallback 稳定化。
 *
 * ✅ 允许：编排子组件、调用 service/navigation/showAlert
 * ❌ 禁止：硬编码样式值 / console.*
 */
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useLayoutEffect,useMemo, useRef, useState } from 'react';
import { Modal,ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { APP_VERSION } from '@/config/version';
import { useAuthContext as useAuth } from '@/contexts/AuthContext';
import { RootStackParamList } from '@/navigation/types';
import { TESTIDS } from '@/testids';
import { useTheme } from '@/theme';
import { showAlert } from '@/utils/alert';
import { homeLog } from '@/utils/logger';

import {
  createHomeScreenStyles,
  EmailForm,
  JoinRoomModal,
  LoginOptions,
  MenuItem,
  UserBar,
} from './components';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC = () => {
  const { colors } = useTheme();
  // Create styles once and pass to all sub-components
  const styles = useMemo(() => createHomeScreenStyles(colors), [colors]);

  const navigation = useNavigation<NavigationProp>();
  const {
    user,
    signInAnonymously,
    signUpWithEmail,
    signInWithEmail,
    signOut,
    loading: authLoading,
    error: authError,
  } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [lastRoomNumber, setLastRoomNumber] = useState<string | null>(null);

  // Loading states for actions
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  // Prevent transient UI states from getting stuck if we navigate away
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setIsCreating(false);
      setIsJoining(false);
    });
    return unsubscribe;
  }, [navigation]);

  // Email auth form state
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  // Load last room number (重新加载当 user 变化时，因为退出登录会清除)
  useEffect(() => {
    AsyncStorage.getItem('lastRoomNumber').then((value) => {
      setLastRoomNumber(value);
    });
  }, [user]);

  // Get user display name
  const userName = useMemo(() => {
    if (!user) return '';
    if (user.isAnonymous) return '匿名用户';
    if (user.displayName) return user.displayName;
    if (user.email) {
      return user.email.split('@')[0];
    }
    return '用户';
  }, [user]);

  const requireAuth = useCallback(
    (action: () => void) => {
      if (!user) {
        showAlert('需要登录', '请先登录后继续', [
          { text: '取消', style: 'cancel' },
          { text: '登录', onPress: () => setShowLoginModal(true) },
        ]);
        return;
      }
      action();
    },
    [user],
  );

  // ============================================
  // Stable callback handlers
  // ============================================

  const handleAnonymousLogin = useCallback(async () => {
    try {
      await signInAnonymously();
      setShowLoginModal(false);
      setShowEmailForm(false);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      homeLog.error(' Error:', e);
      showAlert('登录失败', message || '请稍后重试');
    }
  }, [signInAnonymously]);

  const handleEmailAuth = useCallback(async () => {
    if (!email || !password) {
      showAlert('请输入邮箱和密码');
      return;
    }

    try {
      if (isSignUp) {
        await signUpWithEmail(email, password, displayName || undefined);
        showAlert('注册成功！');
      } else {
        await signInWithEmail(email, password);
      }
      setShowLoginModal(false);
      setShowEmailForm(false);
      setEmail('');
      setPassword('');
      setDisplayName('');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : '未知错误';
      showAlert('错误', message);
    }
  }, [email, password, displayName, isSignUp, signUpWithEmail, signInWithEmail]);

  const resetLoginModal = useCallback(() => {
    setShowLoginModal(false);
    setShowEmailForm(false);
    setEmail('');
    setPassword('');
    setDisplayName('');
    setIsSignUp(false);
  }, []);

  const handleJoinRoom = useCallback(async () => {
    if (roomCode.length !== 4) {
      setJoinError('请输入4位房间号');
      return;
    }

    setJoinError(null);
    setIsJoining(true);

    try {
      await AsyncStorage.setItem('lastRoomNumber', roomCode);
      setShowJoinModal(false);
      navigation.navigate('Room', { roomNumber: roomCode, isHost: false });
      setRoomCode('');
    } catch {
      setJoinError('加入失败，请重试');
    } finally {
      setIsJoining(false);
    }
  }, [roomCode, navigation]);

  const handleReturnToLastGame = useCallback(() => {
    if (!lastRoomNumber) {
      showAlert('提示', '没有上局游戏记录');
      return;
    }
    navigation.navigate('Room', { roomNumber: lastRoomNumber, isHost: false });
  }, [lastRoomNumber, navigation]);

  const handleCancelJoin = useCallback(() => {
    setShowJoinModal(false);
    setRoomCode('');
    setJoinError(null);
    setIsJoining(false);
  }, []);

  const handleCreateRoom = useCallback(() => {
    setIsCreating(true);
    navigation.navigate('Config');
  }, [navigation]);

  const handleShowJoinModal = useCallback(() => {
    setShowJoinModal(true);
  }, []);

  const handleNavigateSettings = useCallback(() => {
    navigation.navigate('Settings');
  }, [navigation]);

  const handleLogin = useCallback(() => {
    setShowLoginModal(true);
  }, []);

  const handleToggleSignUp = useCallback(() => {
    setIsSignUp((prev) => !prev);
  }, []);

  const handleShowEmailForm = useCallback(() => {
    setShowEmailForm(true);
  }, []);

  const handleHideEmailForm = useCallback(() => {
    setShowEmailForm(false);
  }, []);

  // ============================================
  // Memoized menu item handlers (stable references)
  // Use ref pattern so MenuItem can be memoized without comparing onPress,
  // but still call the latest handler that captures current user state.
  // ============================================

  const handleEnterRoomPressRef = useRef(() => {
    requireAuth(handleShowJoinModal);
  });
  useLayoutEffect(() => {
    handleEnterRoomPressRef.current = () => {
      requireAuth(handleShowJoinModal);
    };
  });
  const handleEnterRoomPress = useCallback(() => {
    handleEnterRoomPressRef.current();
  }, []);

  const handleCreateRoomPressRef = useRef(() => {
    requireAuth(handleCreateRoom);
  });
  useLayoutEffect(() => {
    handleCreateRoomPressRef.current = () => {
      requireAuth(handleCreateRoom);
    };
  });
  const handleCreateRoomPress = useCallback(() => {
    handleCreateRoomPressRef.current();
  }, []);

  const handleReturnLastGamePressRef = useRef(() => {
    requireAuth(handleReturnToLastGame);
  });
  useLayoutEffect(() => {
    handleReturnLastGamePressRef.current = () => {
      requireAuth(handleReturnToLastGame);
    };
  });
  const handleReturnLastGamePress = useCallback(() => {
    handleReturnLastGamePressRef.current();
  }, []);

  return (
    <SafeAreaView style={styles.container} testID={TESTIDS.homeScreenRoot}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.logo}>🐺</Text>
          <Text style={styles.title}>狼人杀法官</Text>
          <Text style={styles.subtitle}>Werewolf Judge</Text>
        </View>

        {/* User Bar */}
        <UserBar
          user={user}
          userName={userName}
          onLogin={handleLogin}
          onSignOut={signOut}
          styles={styles}
        />

        {/* Menu */}
        <View style={styles.menu}>
          <MenuItem
            icon={<Ionicons name="log-in-outline" size={22} color={colors.text} />}
            title={isJoining ? '进入中...' : '进入房间'}
            subtitle="输入房间号进入游戏"
            onPress={handleEnterRoomPress}
            testID={TESTIDS.homeEnterRoomButton}
            styles={styles}
          />
          <MenuItem
            icon={<Ionicons name="add-circle-outline" size={22} color={colors.text} />}
            title={isCreating ? '创建中...' : '创建房间'}
            subtitle="开始新的一局游戏"
            onPress={handleCreateRoomPress}
            testID={TESTIDS.homeCreateRoomButton}
            styles={styles}
          />
          <View style={styles.divider} />
          <MenuItem
            icon={<Ionicons name="arrow-undo-outline" size={22} color={colors.text} />}
            title="返回上局"
            subtitle={lastRoomNumber ? `房间 ${lastRoomNumber}` : '没有上局记录'}
            onPress={handleReturnLastGamePress}
            testID={TESTIDS.homeReturnLastGameButton}
            styles={styles}
          />
          <MenuItem
            icon={<Ionicons name="settings-outline" size={22} color={colors.text} />}
            title="设置"
            subtitle="应用偏好设置"
            onPress={handleNavigateSettings}
            styles={styles}
          />
        </View>

        {/* Footer with author and version */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{APP_VERSION} · 作者：严振宇</Text>
        </View>
      </ScrollView>

      {/* Login Modal */}
      <Modal visible={showLoginModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {showEmailForm ? (
              <EmailForm
                isSignUp={isSignUp}
                email={email}
                password={password}
                displayName={displayName}
                authError={authError}
                authLoading={authLoading}
                onEmailChange={setEmail}
                onPasswordChange={setPassword}
                onDisplayNameChange={setDisplayName}
                onSubmit={handleEmailAuth}
                onToggleMode={handleToggleSignUp}
                onBack={handleHideEmailForm}
                styles={styles}
                colors={colors}
              />
            ) : (
              <LoginOptions
                authLoading={authLoading}
                onEmailLogin={handleShowEmailForm}
                onAnonymousLogin={handleAnonymousLogin}
                onCancel={resetLoginModal}
                styles={styles}
              />
            )}
          </View>
        </View>
      </Modal>

      {/* Join Room Modal */}
      <JoinRoomModal
        visible={showJoinModal}
        roomCode={roomCode}
        isLoading={isJoining}
        errorMessage={joinError}
        onRoomCodeChange={setRoomCode}
        onJoin={handleJoinRoom}
        onCancel={handleCancelJoin}
        styles={styles}
      />
    </SafeAreaView>
  );
};
