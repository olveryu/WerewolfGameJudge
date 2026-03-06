/**
 * HomeScreen - 主页入口（登录、加入房间、创建房间）
 *
 * Apple HIG 风格布局：TopBar 品牌+头像+设置 → Hero Card → Action Row → TipCards → Footer。
 * 性能优化：styles factory 集中创建一次，通过 props 传入子组件；handlers 用 useCallback 稳定化。
 * 负责编排子组件、调用 service/navigation/showAlert。
 * 不使用硬编码样式值，不使用 console.*。
 */
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmailForm, LoginOptions } from '@/components/auth';
import { Avatar } from '@/components/Avatar';
import { PressableScale } from '@/components/PressableScale';
import { LAST_ROOM_NUMBER_KEY } from '@/config/storageKeys';
import { APP_VERSION } from '@/config/version';
import { useAuthContext as useAuth } from '@/contexts/AuthContext';
import { useAuthForm } from '@/hooks/useAuthForm';
import { RootStackParamList } from '@/navigation/types';
import { TESTIDS } from '@/testids';
import { useTheme } from '@/theme';
import { componentSizes } from '@/theme/tokens';
import { showAlert } from '@/utils/alert';
import { homeLog } from '@/utils/logger';

import { createHomeScreenStyles, InstallMenuItem, JoinRoomModal, TipCard } from './components';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC = () => {
  const { colors } = useTheme();
  const { width: screenWidth } = useWindowDimensions();
  // Create styles once and pass to all sub-components
  const styles = useMemo(() => createHomeScreenStyles(colors, screenWidth), [colors, screenWidth]);

  const navigation = useNavigation<NavigationProp>();
  const { user, signOut, loading: authLoading, error: authError } = useAuth();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [lastRoomNumber, setLastRoomNumber] = useState<string | null>(null);
  const [dismissedTips, setDismissedTips] = useState<Set<string>>(new Set());

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

  const [showEmailForm, setShowEmailForm] = useState(false);

  const handleAuthSuccess = useCallback(() => {
    setShowLoginModal(false);
    setShowEmailForm(false);
  }, []);

  const {
    email,
    setEmail,
    password,
    setPassword,
    displayName,
    setDisplayName,
    isSignUp,
    handleEmailAuth,
    handleAnonymousLogin,
    resetForm,
    toggleSignUp,
  } = useAuthForm({ onSuccess: handleAuthSuccess, logger: homeLog });

  // Load last room number on mount and when returning to screen
  // (room-not-found clears AsyncStorage, need to re-read on focus)
  useEffect(() => {
    const readLastRoom = () => {
      AsyncStorage.getItem(LAST_ROOM_NUMBER_KEY)
        .then((value) => {
          setLastRoomNumber(value);
        })
        .catch((e: unknown) => {
          homeLog.warn('Failed to read lastRoomNumber from AsyncStorage', e);
        });
    };
    readLastRoom();
    const unsubscribeFocus = navigation.addListener('focus', readLastRoom);
    return unsubscribeFocus;
  }, [user, navigation]);

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

  const resetLoginModal = useCallback(() => {
    setShowLoginModal(false);
    setShowEmailForm(false);
    resetForm();
  }, [resetForm]);

  const handleJoinRoom = useCallback(async () => {
    if (roomCode.length !== 4) {
      setJoinError('请输入4位房间号');
      return;
    }

    setJoinError(null);
    setIsJoining(true);

    try {
      await AsyncStorage.setItem(LAST_ROOM_NUMBER_KEY, roomCode);
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
      showAlert('无记录', '没有上局游戏记录');
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

  // ============================================
  // Profile button handler
  // ============================================

  const handleProfilePress = useCallback(() => {
    if (user) {
      showAlert(userName, user.isAnonymous ? '匿名登录用户' : user.email || '已登录', [
        { text: '取消', style: 'cancel' },
        {
          text: '退出登录',
          style: 'destructive',
          onPress: signOut,
        },
      ]);
    } else {
      setShowLoginModal(true);
    }
  }, [user, userName, signOut]);

  // ============================================
  // Contextual tip card (session-only dismiss)
  // ============================================

  /** Build list of applicable tips based on user state, filtering out dismissed ones. */
  const activeTips = useMemo(() => {
    const all: {
      id: string;
      icon: string;
      title: string;
      subtitle: string;
      onPress?: () => void;
      dismissable?: boolean;
    }[] = [];
    all.push({
      id: 'share',
      icon: '📤',
      title: '邀请朋友？试试分享二维码',
      subtitle: '在房间内点击「分享房间」生成二维码',
      dismissable: false,
    });
    if (!user) {
      all.push({
        id: 'login',
        icon: '👤',
        title: '登录后解锁全部功能',
        subtitle: '创建房间、设置昵称头像需要登录',
        onPress: () => setShowLoginModal(true),
      });
    }
    if (user?.isAnonymous) {
      all.push({
        id: 'upgrade',
        icon: '✉️',
        title: '升级为邮箱账户',
        subtitle: '绑定邮箱后可设置昵称和头像',
        onPress: () => navigation.navigate('Settings'),
      });
    }
    if (user && !user.isAnonymous) {
      all.push({
        id: 'nickname',
        icon: '✏️',
        title: '个性化你的昵称和头像',
        subtitle: '让队友在房间里认出你',
        onPress: () => navigation.navigate('Settings'),
      });
    }
    all.push({
      id: 'theme',
      icon: '🎨',
      title: '试试切换主题',
      subtitle: '8 种主题风格等你探索',
      onPress: () => navigation.navigate('Settings'),
    });
    return all.filter((tip) => tip.dismissable === false || !dismissedTips.has(tip.id));
  }, [dismissedTips, user, navigation]);

  const handleDismissTip = useCallback((tipId: string) => {
    setDismissedTips((prev) => new Set(prev).add(tipId));
  }, []);

  return (
    <SafeAreaView style={styles.container} testID={TESTIDS.homeScreenRoot}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top Bar ─────────────────────────────────── */}
        <View style={styles.topBar}>
          <View style={styles.topBarBrand}>
            <Text style={styles.topBarLogo}>🐺</Text>
            <Text style={styles.topBarTitle}>狼人杀法官</Text>
          </View>
          <View style={styles.topBarActions}>
            <TouchableOpacity
              style={styles.topBarButton}
              onPress={handleProfilePress}
              activeOpacity={0.7}
              testID={user ? TESTIDS.homeUserBar : TESTIDS.homeLoginButton}
              accessibilityLabel={user ? userName : '登录'}
            >
              {user && !user.isAnonymous ? (
                <Avatar
                  value={user.uid}
                  size={componentSizes.avatar.sm}
                  avatarUrl={user.avatarUrl}
                />
              ) : (
                <Ionicons
                  name="person-circle-outline"
                  size={componentSizes.icon.lg}
                  color={colors.textSecondary}
                />
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.topBarButton}
              onPress={handleNavigateSettings}
              activeOpacity={0.7}
              accessibilityLabel="设置"
              testID={TESTIDS.homeSettingsButton}
            >
              <Ionicons
                name="settings-outline"
                size={componentSizes.icon.md}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>
        </View>

        {user && (
          <Text style={styles.userNameHidden} testID={TESTIDS.homeUserName}>
            {userName}
          </Text>
        )}

        {/* ── Hero Card — Create Room ─────────────────── */}
        <PressableScale
          onPress={handleCreateRoomPress}
          disabled={authLoading}
          style={styles.heroCard}
          testID={TESTIDS.homeCreateRoomButton}
          haptic
        >
          <View style={styles.heroCardContent}>
            <Text style={styles.heroCardTitle}>{isCreating ? '创建中...' : '创建房间'}</Text>
            <Text style={styles.heroCardSubtitle}>开始一局新游戏</Text>
          </View>
          {isCreating ? (
            <ActivityIndicator color={colors.textInverse} size="small" />
          ) : (
            <View style={styles.heroCardArrow}>
              <Ionicons
                name="chevron-forward"
                size={componentSizes.icon.md}
                color={colors.textInverse}
              />
            </View>
          )}
        </PressableScale>

        {/* ── Action Row — Enter Room + Return to Last Game ── */}
        <View style={styles.actionRow}>
          <PressableScale
            onPress={handleEnterRoomPress}
            disabled={authLoading}
            style={[styles.actionCard, authLoading && styles.actionCardDisabled]}
            testID={TESTIDS.homeEnterRoomButton}
          >
            <View style={styles.actionCardIcon}>
              <Ionicons name="log-in-outline" size={22} color={colors.text} />
            </View>
            <Text style={styles.actionCardTitle}>{isJoining ? '进入中...' : '进入房间'}</Text>
            <Text style={styles.actionCardSubtitle}>输入房间号</Text>
          </PressableScale>
          <PressableScale
            onPress={handleReturnLastGamePress}
            disabled={authLoading}
            style={[styles.actionCard, authLoading && styles.actionCardDisabled]}
            testID={TESTIDS.homeReturnLastGameButton}
          >
            <View style={styles.actionCardIcon}>
              <Ionicons name="arrow-undo-outline" size={22} color={colors.text} />
            </View>
            <Text style={styles.actionCardTitle}>返回上局</Text>
            <Text style={styles.actionCardSubtitle}>
              {lastRoomNumber ? `房间 ${lastRoomNumber}` : '无记录'}
            </Text>
          </PressableScale>
        </View>

        {/* ── Contextual Tips ────────────────────────── */}
        {activeTips.map((tip) => (
          <TipCard
            key={tip.id}
            tipId={tip.id}
            icon={tip.icon}
            title={tip.title}
            subtitle={tip.subtitle}
            onPress={tip.onPress}
            onDismiss={tip.dismissable !== false ? handleDismissTip : undefined}
            styles={styles}
            colors={colors}
            testID={TESTIDS.homeTipCard}
          />
        ))}

        {/* Footer with author and version */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{APP_VERSION} · 作者：严振宇</Text>
          <InstallMenuItem styles={styles} colors={colors} />
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
                onToggleMode={toggleSignUp}
                onBack={handleHideEmailForm}
                styles={styles}
                colors={colors}
              />
            ) : (
              <LoginOptions
                authLoading={authLoading}
                title="登录"
                subtitle="选择登录方式继续"
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
