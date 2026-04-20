/**
 * HomeScreen - 主页入口（登录、加入房间、创建房间）
 *
 * Apple HIG 风格布局：TopBar 品牌+头像 → Hero Card → Action Row →
 * RandomRoleCard → Changelog Card → Footer。
 * 性能优化：styles factory 集中创建一次，通过 props 传入子组件；handlers 用 useCallback 稳定化。
 * 负责编排子组件、调用 service/navigation/showAlert。
 * 不使用硬编码样式值，不使用 console.*。
 */
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import {
  Faction,
  getAllRoleIds,
  getRoleSpec,
  isWolfRole,
} from '@werewolf/game-engine/models/roles';
import { randomIntInclusive } from '@werewolf/game-engine/utils/random';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/Button';
import { PressableScale } from '@/components/PressableScale';
import { UserAvatar } from '@/components/UserAvatar';
import { ANNOUNCEMENTS } from '@/config/announcements';
import { LAST_ROOM_NUMBER_KEY, LAST_SEEN_VERSION_KEY } from '@/config/storageKeys';
import { APP_VERSION } from '@/config/version';
import { useAuthContext as useAuth } from '@/contexts/AuthContext';
import { useAutoClaimDailyReward, useGachaStatusQuery } from '@/hooks/queries/useGachaQuery';
import { storage } from '@/lib/storage';
import { RootStackParamList } from '@/navigation/types';
import { TESTIDS } from '@/testids';
import { colors, componentSizes, layout } from '@/theme';
import { showErrorAlert } from '@/utils/alertPresets';
import { AVATAR_IMAGES, AVATAR_KEYS } from '@/utils/avatar';
import { homeLog } from '@/utils/logger';
import { isMiniProgram, wxReLaunch } from '@/utils/miniProgram';

import {
  AnnouncementModal,
  createHomeScreenStyles,
  InstallMenuItem,
  JoinRoomModal,
  RandomRoleCard,
} from './components';

type NavigationProp = NativeStackNavigationProp<RootStackParamList, 'Home'>;

export const HomeScreen: React.FC = () => {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  // Create styles once and pass to all sub-components
  const styles = useMemo(() => createHomeScreenStyles(colors, screenWidth), [screenWidth]);

  const navigation = useNavigation<NavigationProp>();
  const { user, loading: authLoading, error: authError } = useAuth();
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [lastRoomNumber, setLastRoomNumber] = useState<string | null>(null);

  // Announcement modal state (auto-show once per version + manual open from card)
  const [showAnnouncement, setShowAnnouncement] = useState(false);

  // Show announcement after auth loading settles (avoid flashing modal over loading state)
  useEffect(() => {
    if (authLoading) return;
    const lastSeen = storage.getString(LAST_SEEN_VERSION_KEY);
    if (lastSeen === APP_VERSION) return;
    if (ANNOUNCEMENTS[APP_VERSION]) {
      setShowAnnouncement(true);
      return;
    }
    // No announcement for this version — silently mark as seen
    storage.set(LAST_SEEN_VERSION_KEY, APP_VERSION);
  }, [authLoading]);

  // Loading states for actions
  const [isJoining, setIsJoining] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const pendingActionRef = useRef<(() => void) | null>(null);

  // Ticket count for top bar badge (shared cache via TanStack Query)
  const { data: gachaStatus } = useGachaStatusQuery();
  const ticketCount = gachaStatus ? gachaStatus.normalDraws + gachaStatus.goldenDraws : null;

  // Auto-claim daily login reward (fires once per session when status loads)
  useAutoClaimDailyReward();

  // Prevent transient UI states from getting stuck if we navigate away.
  // Also clear stale pending auth action if user didn't complete login before leaving.
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      setIsCreating(false);
      setIsJoining(false);
      if (!user) {
        pendingActionRef.current = null;
      }
    });
    return unsubscribe;
  }, [navigation, user]);

  // When user state changes from null to non-null, run pending action (after auth modal)
  const prevUserRef = useRef(user);
  useEffect(() => {
    if (!prevUserRef.current && user) {
      const action = pendingActionRef.current;
      pendingActionRef.current = null;
      if (action) action();
    }
    prevUserRef.current = user;
  }, [user]);

  // Load last room number on mount and when returning to screen
  // (room-not-found clears MMKV, need to re-read on focus)
  useEffect(() => {
    const readLastRoom = () => {
      setLastRoomNumber(storage.getString(LAST_ROOM_NUMBER_KEY) ?? null);
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
        pendingActionRef.current = action;
        navigation.navigate('AuthLogin', { loginTitle: '登录', loginSubtitle: '选择登录方式继续' });
        return;
      }
      action();
    },
    [user, navigation],
  );

  const handleJoinRoom = useCallback(async () => {
    if (roomCode.length !== 4) {
      setJoinError('请输入4位房间号');
      return;
    }

    setJoinError(null);
    setIsJoining(true);
    homeLog.info('Join room', { roomCode });

    try {
      storage.set(LAST_ROOM_NUMBER_KEY, roomCode);
      setShowJoinModal(false);
      navigation.navigate('Room', { roomNumber: roomCode, isHost: false });
      setRoomCode('');
    } catch {
      homeLog.warn('Join failed');
      setJoinError('加入失败，请重试');
    } finally {
      setIsJoining(false);
    }
  }, [roomCode, navigation]);

  const handleReturnToLastGame = useCallback(() => {
    if (!lastRoomNumber) {
      showErrorAlert('无记录', '没有上局游戏记录');
      return;
    }
    homeLog.info('Return to last game', { roomNumber: lastRoomNumber });
    navigation.navigate('Room', { roomNumber: lastRoomNumber, isHost: false });
  }, [lastRoomNumber, navigation]);

  const handleCancelJoin = useCallback(() => {
    setShowJoinModal(false);
    setRoomCode('');
    setJoinError(null);
    setIsJoining(false);
  }, []);

  const handleCreateRoom = useCallback(() => {
    homeLog.info('Create room');
    setIsCreating(true);
    navigation.navigate('BoardPicker');
  }, [navigation]);

  const handleShowJoinModal = useCallback(() => {
    setShowJoinModal(true);
  }, []);

  const handleNavigateSettings = useCallback(() => {
    navigation.navigate('Settings');
  }, [navigation]);

  const handleNavigateEncyclopedia = useCallback(() => {
    navigation.navigate('Encyclopedia');
  }, [navigation]);

  const handleNavigateGacha = useCallback(() => {
    navigation.navigate('Gacha');
  }, [navigation]);

  // ============================================
  // Random Role Card state (F8)
  // ============================================

  const allRoleIds = useMemo(() => getAllRoleIds(), []);
  const [randomRoleIndex, setRandomRoleIndex] = useState(() =>
    randomIntInclusive(0, getAllRoleIds().length - 1),
  );

  const handleRefreshRole = useCallback(() => {
    setRandomRoleIndex((prev) => {
      let next: number;
      do {
        next = randomIntInclusive(0, allRoleIds.length - 1);
      } while (next === prev && allRoleIds.length > 1);
      return next;
    });
  }, [allRoleIds.length]);

  const randomRoleData = useMemo(() => {
    const roleId = allRoleIds[randomRoleIndex % allRoleIds.length];
    const spec = getRoleSpec(roleId);
    // Map faction to color + label
    let factionColor = colors.villager;
    let factionLabel = '村民';
    if (isWolfRole(roleId)) {
      factionColor = colors.wolf;
      factionLabel = '狼人';
    } else if (spec.faction === Faction.God) {
      factionColor = colors.god;
      factionLabel = '神职';
    } else if (spec.faction === Faction.Special) {
      factionColor = colors.third;
      factionLabel = '第三方';
    }
    // Avatar image: AVATAR_KEYS matches RoleId names, use indexOf for exact match
    const avatarKeyIdx = AVATAR_KEYS.indexOf(roleId);
    const avatarImage = avatarKeyIdx >= 0 ? AVATAR_IMAGES[avatarKeyIdx] : AVATAR_IMAGES[0];
    return {
      roleId,
      displayName: spec.displayName,
      description: spec.description,
      factionColor,
      factionLabel,
      avatarImage,
    };
  }, [allRoleIds, randomRoleIndex]);

  const handleRoleDetail = useCallback(() => {
    navigation.navigate('Encyclopedia', { roleId: randomRoleData.roleId });
  }, [navigation, randomRoleData.roleId]);

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

  const handleCloseAnnouncement = useCallback(() => {
    setShowAnnouncement(false);
    storage.set(LAST_SEEN_VERSION_KEY, APP_VERSION);
  }, []);

  const handleOpenAnnouncement = useCallback(() => {
    setShowAnnouncement(true);
  }, []);

  const handleRetryAuth = useCallback(() => {
    if (isMiniProgram()) {
      wxReLaunch();
    } else {
      // 非小程序环境，刷新页面重新走 auth 流程
      window.location.reload();
    }
  }, []);

  return (
    <SafeAreaView
      style={styles.container}
      edges={['left', 'right']}
      testID={TESTIDS.homeScreenRoot}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          insets.bottom > 0 && { paddingBottom: insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Top Bar ─────────────────────────────────── */}
        <View style={[styles.topBar, { paddingTop: insets.top + layout.headerPaddingV }]}>
          <View style={styles.topBarBrand}>
            <Text style={styles.topBarTitle}>狼人kill电子裁判</Text>
          </View>
          <View style={styles.topBarActions}>
            <Button
              variant="icon"
              onPress={handleNavigateEncyclopedia}
              testID={TESTIDS.homeEncyclopediaButton}
              accessibilityLabel="角色图鉴"
            >
              <Ionicons
                name="book-outline"
                size={componentSizes.icon.md}
                color={colors.textSecondary}
              />
            </Button>

            <UserAvatar
              user={user}
              ticketCount={ticketCount}
              onPress={handleNavigateSettings}
              testID={TESTIDS.homeSettingsButton}
            />
          </View>
        </View>

        {user && (
          <Text style={styles.userNameHidden} testID={TESTIDS.homeUserName}>
            {userName}
          </Text>
        )}

        {/* ── Auth Error Banner ─────────────────── */}
        {!authLoading && !user && authError && (
          <View style={styles.authErrorBanner}>
            <Ionicons
              name="cloud-offline-outline"
              size={componentSizes.icon.md}
              color={colors.error}
            />
            <View style={styles.authErrorTextGroup}>
              <Text style={styles.authErrorTitle}>网络异常</Text>
              <Text style={styles.authErrorSubtitle}>登录失败，请检查网络后重试</Text>
            </View>
            <PressableScale onPress={handleRetryAuth} style={styles.authErrorRetryBtn} haptic>
              <Text style={styles.authErrorRetryText}>重试</Text>
            </PressableScale>
          </View>
        )}

        {/* ── Hero Card — Create Room ─────────────────── */}
        <PressableScale
          onPress={handleCreateRoomPress}
          disabled={authLoading}
          style={styles.heroCard}
          testID={TESTIDS.homeCreateRoomButton}
          haptic
        >
          <LinearGradient
            colors={[colors.primaryLight, colors.primary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCardGradient}
          >
            <View style={styles.heroCardContent}>
              <Text style={styles.heroCardTitle}>{isCreating ? '创建中' : '创建房间'}</Text>
              <Text style={styles.heroCardSubtitle}>开始一局新游戏</Text>
            </View>
            {isCreating ? (
              <ActivityIndicator color={colors.textInverse} size="small" />
            ) : (
              <View style={styles.heroCardArrow}>
                <Ionicons
                  name="chevron-forward"
                  size={componentSizes.icon.lg}
                  color={colors.textInverse}
                />
              </View>
            )}
          </LinearGradient>
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
              <Ionicons
                name="log-in-outline"
                size={componentSizes.icon.lg}
                color={colors.primary}
              />
            </View>
            <Text style={styles.actionCardTitle}>{isJoining ? '进入中' : '进入房间'}</Text>
            <Text style={styles.actionCardSubtitle}>输入房间号</Text>
          </PressableScale>
          <PressableScale
            onPress={handleReturnLastGamePress}
            disabled={authLoading}
            style={[styles.actionCard, authLoading && styles.actionCardDisabled]}
            testID={TESTIDS.homeReturnLastGameButton}
          >
            <View style={styles.actionCardIcon}>
              <Ionicons
                name="arrow-undo-outline"
                size={componentSizes.icon.lg}
                color={colors.primary}
              />
            </View>
            <Text style={styles.actionCardTitle}>返回上局</Text>
            <Text style={styles.actionCardSubtitle}>
              {lastRoomNumber ? `房间 ${lastRoomNumber}` : '无记录'}
            </Text>
          </PressableScale>
        </View>

        {/* ── Gacha Entry ─────────────────────────── */}
        <PressableScale
          onPress={handleNavigateGacha}
          style={[styles.gachaCard, styles.gachaCardAccentGold]}
          haptic
        >
          <Text style={styles.gachaCardEmoji}>🎰</Text>
          <View style={styles.gachaCardText}>
            <Text style={styles.gachaCardTitle}>扭蛋抽奖</Text>
            <Text style={styles.gachaCardSubtitle}>用抽奖券解锁头像、头像框、装饰</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.textMuted} />
        </PressableScale>

        {/* ── Random Role Card (F8) ───────────────── */}
        <RandomRoleCard
          roleId={randomRoleData.roleId}
          displayName={randomRoleData.displayName}
          description={randomRoleData.description}
          factionColor={randomRoleData.factionColor}
          factionLabel={randomRoleData.factionLabel}
          avatarImage={randomRoleData.avatarImage}
          onRefresh={handleRefreshRole}
          onDetail={handleRoleDetail}
          styles={styles}
          colors={colors}
        />

        {/* ── Changelog Card ────────────────────────── */}
        {ANNOUNCEMENTS[APP_VERSION] && (
          <PressableScale
            onPress={handleOpenAnnouncement}
            style={[styles.gachaCard, styles.gachaCardAccentBlue]}
            haptic
          >
            <Ionicons name="sparkles" size={componentSizes.icon.md} color={colors.primary} />
            <View style={styles.gachaCardText}>
              <Text style={styles.gachaCardTitle}>{APP_VERSION} 更新日志</Text>
              <Text style={styles.gachaCardSubtitle}>查看本次更新内容</Text>
            </View>
            <Ionicons
              name="chevron-forward"
              size={componentSizes.icon.sm}
              color={colors.textMuted}
            />
          </PressableScale>
        )}

        {/* Footer with author and version */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>{APP_VERSION} · 作者：严振宇</Text>
          <InstallMenuItem styles={styles} colors={colors} />
        </View>
      </ScrollView>

      {/* Join Room Modal */}
      <JoinRoomModal
        visible={showJoinModal}
        roomCode={roomCode}
        isLoading={isJoining}
        errorMessage={joinError}
        onRoomCodeChange={setRoomCode}
        onJoin={() => {
          void handleJoinRoom();
        }}
        onCancel={handleCancelJoin}
        styles={styles}
      />

      {/* What's New announcement modal */}
      <AnnouncementModal visible={showAnnouncement} onClose={handleCloseAnnouncement} />
    </SafeAreaView>
  );
};
